import { ENV } from "./_core/env";

export type ApplicantRecord = {
  applicant_id: number;
  email: string | null;
  mobile: string | null;
  password_hash: string | null;
  is_verified: boolean | null;
};

export type AdmissionStatus = "Pending" | "Approved" | "Rejected" | "Waitlisted";
export type ApplicationType = "Freshmen" | "Transferee" | "Ladderized";
export type AdmissionDocumentRecord = { doc_type: string; file_name: string | null; file_size_bytes: number | null; file_path: string | null };
export type AdmissionDetail = {
  admission_id: number;
  status: AdmissionStatus | null;
  application_type: ApplicationType | null;
  strand: string | null;
  prev_school: string | null;
  prev_school_address: string | null;
  school_type: string | null;
  year_graduated: number | null;
  gwa: number | null;
  honors: string | null;
  exam_type: string | null;
  exam_date: string | null;
  exam_time_slot: string | null;
  exam_venue: string | null;
  CAMPUS?: { campus_name: string | null } | null;
  PROGRAM?: { program_name: string | null; college: string | null } | null;
  documents: AdmissionDocumentRecord[];
};

export type CampusRecord = { campus_id: number; campus_name: string | null };
export type ProgramRecord = { program_id: number; program_name: string | null; college: string | null };
export type ApprovedAdmission = { admission_id: number; applicant_id: number; campus_id: number; program_id: number; previous_school: string | null; status: AdmissionStatus | null };
export type CourseSubjectRecord = { subject_code: string; program_id: number; title: string | null; units: number | null; days: string | null; time_slot: string | null; room: string | null; instructor: string | null; subject_type: string | null; is_required: boolean | null };

type SupabaseRequestOptions = RequestInit & {
  parseJson?: boolean;
};

async function supabaseRequest<T>(
  path: string,
  options: SupabaseRequestOptions = {},
): Promise<T> {
  if (!ENV.supabaseUrl || !ENV.supabaseServerKey) {
    throw new Error("Supabase server configuration is missing");
  }

  const response = await fetch(`${ENV.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ENV.supabaseServerKey,
      Authorization: `Bearer ${ENV.supabaseServerKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${body}`);
  }

  if (options.parseJson === false || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getApplicantByEmail(email: string) {
  const query = new URLSearchParams({
    select: "applicant_id,email,mobile,password_hash,is_verified",
    email: `eq.${email}`,
    limit: "1",
  });

  const applicants = await supabaseRequest<ApplicantRecord[]>(
    `APPLICANT?${query.toString()}`,
  );

  return applicants[0] ?? null;
}

export async function insertApplicant(input: {
  email: string;
  mobile: string;
  passwordHash: string;
}) {
  const applicants = await supabaseRequest<ApplicantRecord[]>("APPLICANT", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      email: input.email,
      mobile: input.mobile,
      password_hash: input.passwordHash,
      is_verified: false,
    }),
  });

  return applicants[0] ?? null;
}

export async function getLatestAdmissionStatus(applicantId: number) {
  const query = new URLSearchParams({
    select: "admission_id,status",
    applicant_id: `eq.${applicantId}`,
    order: "admission_id.desc",
    limit: "1",
  });

  const applications = await supabaseRequest<Array<{ admission_id: number; status: AdmissionStatus | null }>>(
    `ADMISSION_APPLICATION?${query.toString()}`,
  );

  return applications[0]?.status ?? null;
}

export async function getLatestAdmissionDetail(applicantId: number): Promise<AdmissionDetail | null> {
  const query = new URLSearchParams({
    select: "admission_id,status,application_type,strand,prev_school,prev_school_address,school_type,year_graduated,gwa,honors,exam_type,exam_date,exam_time_slot,exam_venue,CAMPUS(campus_name),PROGRAM(program_name,college)",
    applicant_id: `eq.${applicantId}`,
    order: "admission_id.desc",
    limit: "1",
  });
  const applications = await supabaseRequest<Array<Omit<AdmissionDetail, "documents">>>(`ADMISSION_APPLICATION?${query.toString()}`);
  const application = applications[0];
  if (!application) return null;

  const documentsQuery = new URLSearchParams({
    select: "doc_type,file_name,file_size_bytes,file_path",
    admission_id: `eq.${application.admission_id}`,
    order: "doc_type.asc",
  });
  const documents = await supabaseRequest<AdmissionDocumentRecord[]>(`ADMISSION_DOCUMENT?${documentsQuery.toString()}`);
  return { ...application, documents };
}

export async function getCampuses() {
  const query = new URLSearchParams({
    select: "campus_id,campus_name",
    order: "campus_name.asc",
  });
  return supabaseRequest<CampusRecord[]>(`CAMPUS?${query.toString()}`);
}

export async function getPrograms() {
  const query = new URLSearchParams({
    select: "program_id,program_name,college",
    order: "program_name.asc",
  });
  return supabaseRequest<ProgramRecord[]>(`PROGRAM?${query.toString()}`);
}

export async function getProgramsForCampus(campusId: number) {
  const query = new URLSearchParams({
    select: "program_id,program_name,college,PROGRAM_CAMPUS!inner(campus_id)",
    "PROGRAM_CAMPUS.campus_id": `eq.${campusId}`,
    order: "program_name.asc",
  });
  const programs = await supabaseRequest<Array<ProgramRecord & { PROGRAM_CAMPUS?: Array<{ campus_id: number }> }>>(
    `PROGRAM?${query.toString()}`,
  );
  return programs.map(({ PROGRAM_CAMPUS: _links, ...program }) => program);
}

export async function updateApplicantProfile(input: {
  applicantId: number;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  sex: string;
  civilStatus: string;
  birthDate: string;
  email: string;
  mobile: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
}) {
  const query = new URLSearchParams({ applicant_id: `eq.${input.applicantId}` });
  const applicants = await supabaseRequest<ApplicantRecord[]>(`APPLICANT?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      lrn: input.lrn,
      last_name: input.lastName,
      first_name: input.firstName,
      middle_name: input.middleName,
      suffix: input.suffix,
      sex: input.sex,
      civil_status: input.civilStatus,
      birth_date: input.birthDate,
      email: input.email,
      mobile: input.mobile,
      region: input.region,
      province: input.province,
      city: input.city,
      barangay: input.barangay,
    }),
  });

  return applicants[0] ?? null;
}

export async function createAdmissionApplication(input: {
  applicantId: number;
  campusId: number;
  programId: number;
  applicationType: ApplicationType;
  strand: string;
  prevSchool: string;
  prevSchoolAddress: string;
  schoolType: string;
  yearGraduated: number;
  gwa: number;
  honors: string;
  examType: string;
  examDate: string;
  examTimeSlot: string;
  examVenue: string;
  admissionNo?: string;
}) {
  const applications = await supabaseRequest<Array<{ admission_id: number; status: AdmissionStatus | null }>>(
    "ADMISSION_APPLICATION",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        applicant_id: input.applicantId,
        campus_id: input.campusId,
        program_id: input.programId,
        application_type: input.applicationType,
        strand: input.strand,
        prev_school: input.prevSchool,
        prev_school_address: input.prevSchoolAddress,
        school_type: input.schoolType,
        year_graduated: input.yearGraduated,
        gwa: input.gwa,
        honors: input.honors,
        exam_type: input.examType,
        exam_date: input.examDate,
        exam_time_slot: input.examTimeSlot,
        exam_venue: input.examVenue,
        status: "Pending",
        ...(input.admissionNo ? { admission_no: input.admissionNo } : {}),
      }),
    },
  );

  return applications[0] ?? null;
}

const DOCUMENT_BUCKET = "admission-documents";

export async function ensureDocumentBucket() {
  if (!ENV.supabaseUrl || !ENV.supabaseServerKey) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${ENV.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: ENV.supabaseServerKey,
      Authorization: `Bearer ${ENV.supabaseServerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: DOCUMENT_BUCKET, name: DOCUMENT_BUCKET, public: false }),
  });
  if (!response.ok) {
    const body = await response.text();
    let details: { code?: string; error?: string } = {};
    try {
      details = JSON.parse(body) as typeof details;
    } catch {
      // Keep the raw response in the error below.
    }
    const bucketAlreadyExists = response.status === 409 || details.code === "BucketAlreadyExists" || details.error === "Duplicate";
    if (!bucketAlreadyExists) throw new Error(`Supabase storage bucket failed (${response.status}): ${body}`);
  }
}

export async function uploadAdmissionDocument(input: {
  admissionId: number;
  fileName: string;
  contentType: string;
  contentBase64: string;
}) {
  if (!ENV.supabaseUrl || !ENV.supabaseServerKey) throw new Error("Supabase server configuration is missing");
  await ensureDocumentBucket();
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `admission-${input.admissionId}/${crypto.randomUUID()}-${safeFileName}`;
  const response = await fetch(`${ENV.supabaseUrl}/storage/v1/object/${DOCUMENT_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: ENV.supabaseServerKey,
      Authorization: `Bearer ${ENV.supabaseServerKey}`,
      "Content-Type": input.contentType || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(input.contentBase64, "base64"),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase document upload failed (${response.status}): ${body}`);
  }
  return `${DOCUMENT_BUCKET}/${objectPath}`;
}

export async function insertAdmissionDocuments(documents: Array<{
  admissionId: number;
  docType: string;
  fileName: string;
  fileSizeBytes: number;
  filePath: string;
}>) {
  if (documents.length === 0) return [];
  return supabaseRequest<Array<{ document_id: number }>>("ADMISSION_DOCUMENT", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(documents.map(document => ({
      admission_id: document.admissionId,
      doc_type: document.docType,
      file_name: document.fileName,
      file_size_bytes: document.fileSizeBytes,
      file_path: document.filePath,
      status: "Pending",
    }))),
  });
}

export async function getLatestApprovedAdmission(applicantId: number) {
  const query = new URLSearchParams({
    select: "admission_id,applicant_id,campus_id,program_id,previous_school,status",
    applicant_id: `eq.${applicantId}`,
    order: "admission_id.desc",
    limit: "1",
  });
  const applications = await supabaseRequest<ApprovedAdmission[]>(`ADMISSION_APPLICATION?${query.toString()}`);
  const application = applications[0];
  return application?.status === "Approved" ? application : null;
}

export async function getCourseSubjectsForProgram(programId: number) {
  const query = new URLSearchParams({
    select: "subject_code,program_id,title,units,days,time_slot,room,instructor,subject_type,is_required",
    program_id: `eq.${programId}`,
    order: "subject_code.asc",
  });
  return supabaseRequest<CourseSubjectRecord[]>(`COURSE_SUBJECT?${query.toString()}`);
}

export async function createEnrollment(input: {
  applicantId: number;
  admissionId: number;
  campusId: number;
  programId: number;
  previousSchool: string;
  enrollmentRefCode: string;
  insuranceRefNumber: string;
}) {
  const enrollments = await supabaseRequest<Array<{ enrollment_id: number; enrollment_ref_code: string }>>("ENROLLMENT", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      applicant_id: input.applicantId,
      admission_id: input.admissionId,
      campus_id: input.campusId,
      program_id: input.programId,
      previous_school: input.previousSchool,
      enrollment_ref_code: input.enrollmentRefCode,
      insurance_ref_number: input.insuranceRefNumber,
      payment_status: "Unpaid",
    }),
  });
  return enrollments[0] ?? null;
}

export async function createEmergencyContact(input: {
  enrollmentId: number;
  fullName: string;
  relationship: string;
  mobile: string;
  email: string;
}) {
  return supabaseRequest("EMERGENCY_CONTACT", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      enrollment_id: input.enrollmentId,
      full_name: input.fullName,
      relationship: input.relationship,
      mobile: input.mobile,
      email: input.email,
    }),
  });
}

export async function createScholarship(input: {
  enrollmentId: number;
  scholarshipType: string;
  scholarshipName: string;
  grantingBody: string;
}) {
  return supabaseRequest("SCHOLARSHIP", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      enrollment_id: input.enrollmentId,
      scholarship_type: input.scholarshipType,
      scholarship_name: input.scholarshipName,
      granting_body: input.grantingBody,
    }),
  });
}

export async function insertMedicalDocuments(documents: Array<{
  enrollmentId: number;
  docType: string;
  fileName: string;
  fileSizeBytes: number;
  filePath: string;
}>) {
  if (documents.length === 0) return [];
  return supabaseRequest("MEDICAL_DOCUMENT", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(documents.map(document => ({
      enrollment_id: document.enrollmentId,
      doc_type: document.docType,
      file_name: document.fileName,
      file_size_bytes: document.fileSizeBytes,
      file_path: document.filePath,
    }))),
  });
}

export async function uploadMedicalDocument(input: {
  enrollmentId: number;
  fileName: string;
  contentType: string;
  contentBase64: string;
}) {
  if (!ENV.supabaseUrl || !ENV.supabaseServerKey) throw new Error("Supabase server configuration is missing");
  await ensureDocumentBucket();
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `enrollment-${input.enrollmentId}/${crypto.randomUUID()}-${safeFileName}`;
  const response = await fetch(`${ENV.supabaseUrl}/storage/v1/object/${DOCUMENT_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: ENV.supabaseServerKey,
      Authorization: `Bearer ${ENV.supabaseServerKey}`,
      "Content-Type": input.contentType || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(input.contentBase64, "base64"),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase medical upload failed (${response.status}): ${body}`);
  }
  return `${DOCUMENT_BUCKET}/${objectPath}`;
}

export async function insertEnrollmentSubjects(enrollmentId: number, subjectCodes: string[]) {
  if (subjectCodes.length === 0) return [];
  return supabaseRequest("ENROLLMENT_SUBJECT", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(subjectCodes.map(subjectCode => ({ enrollment_id: enrollmentId, subject_code: subjectCode }))),
  });
}
