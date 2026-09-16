import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearApplicantSession, createApplicantSession, hashPassword, readApplicantSession, setApplicantSession, verifyPassword } from "./applicantAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createAdmissionApplication, createEmergencyContact, createEnrollment, createScholarship, ensureDocumentBucket, getApplicantByEmail, getCampuses, getCourseSubjectsForProgram, getLatestAdmissionDetail, getLatestAdmissionStatus, getLatestApprovedAdmission, getPrograms, getProgramsForCampus, insertAdmissionDocuments, insertEnrollmentSubjects, insertApplicant, insertMedicalDocuments, updateApplicantProfile, uploadAdmissionDocument, uploadMedicalDocument } from "./supabase";

const credentialsInput = z.object({
  email: z.string().trim().email("Enter a valid email address").max(320),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const registerInput = credentialsInput.extend({
  mobile: z.string().trim().min(7, "Enter a valid mobile number").max(32),
});

const applicationType = z.enum(["Freshmen", "Transferee", "Ladderized"]);

const admissionSubmitInput = z.object({
  applicationType,
  lrn: z.string().trim().min(1).max(64),
  lastName: z.string().trim().min(1).max(120),
  firstName: z.string().trim().min(1).max(120),
  middleName: z.string().trim().max(120),
  suffix: z.string().trim().max(32),
  sex: z.string().trim().min(1).max(32),
  civilStatus: z.string().trim().min(1).max(32),
  birthDate: z.string().date(),
  email: z.string().trim().email().max(320),
  mobile: z.string().trim().regex(/^\d{11}$/, "Mobile number must contain exactly 11 digits"),
  region: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  barangay: z.string().trim().min(1).max(120),
  strand: z.string().trim().max(120),
  prevSchool: z.string().trim().min(1).max(240),
  prevSchoolAddress: z.string().trim().min(1).max(320),
  schoolType: z.string().trim().min(1).max(64),
  yearGraduated: z.coerce.number().int().min(1900).max(2100),
  gwa: z.coerce.number().min(0).max(100),
  honors: z.string().trim().max(240),
  campusId: z.coerce.number().int().positive(),
  programId: z.coerce.number().int().positive(),
  examType: z.string().trim().min(1).max(120),
  examDate: z.string().date(),
  examTimeSlot: z.string().trim().min(1).max(120),
  examVenue: z.string().trim().min(1).max(240),
  documents: z.array(z.object({
    docType: z.string().trim().min(1).max(160),
    fileName: z.string().trim().min(1).max(240),
    fileSizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
    contentType: z.string().trim().max(120),
    contentBase64: z.string().min(1).max(12_000_000),
  })).max(8),
});

const requiredDocumentsByType: Record<z.infer<typeof applicationType>, string[]> = {
  Freshmen: ["Form 138/Report Card", "PSA Birth Certificate", "Good Moral Certificate", "2x2 Photo"],
  Transferee: ["Transcript of Records", "Honorable Dismissal/Transfer Credential", "Good Moral Certificate", "PSA Birth Certificate", "2x2 Photo"],
  Ladderized: ["Certificate/Diploma from previous ladder level", "Transcript of Records", "Good Moral Certificate", "PSA Birth Certificate", "2x2 Photo"],
};

const enrollmentSubmitInput = z.object({
  previousSchool: z.string().trim().min(1).max(240),
  insuranceRefNumber: z.string().trim().max(160),
  emergencyContact: z.object({
    fullName: z.string().trim().min(1).max(160),
    relationship: z.string().trim().min(1).max(80),
    mobile: z.string().trim().min(7).max(32),
    email: z.string().trim().email().max(320),
  }),
  scholarship: z.object({
    scholarshipType: z.string().trim().min(1).max(120),
    scholarshipName: z.string().trim().min(1).max(200),
    grantingBody: z.string().trim().min(1).max(200),
  }).nullable(),
  medicalDocuments: z.array(z.object({
    docType: z.string().trim().min(1).max(160),
    fileName: z.string().trim().min(1).max(240),
    fileSizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
    contentType: z.string().trim().max(120),
    contentBase64: z.string().min(1).max(12_000_000),
  })).max(5),
  subjectCodes: z.array(z.string().trim().min(1).max(64)).min(1).max(30),
});

function publicApplicant(applicant: {
  applicant_id: number;
  email: string | null;
  mobile: string | null;
  is_verified: boolean | null;
}) {
  return {
    applicantId: applicant.applicant_id,
    email: applicant.email,
    mobile: applicant.mobile,
    isVerified: Boolean(applicant.is_verified),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  applicantAuth: router({
    register: publicProcedure.input(registerInput).mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase();
      const existing = await getApplicantByEmail(email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      }

      try {
        const applicant = await insertApplicant({
          email,
          mobile: input.mobile,
          passwordHash: await hashPassword(input.password),
        });
        if (!applicant) throw new Error("Applicant record was not returned after registration");

        setApplicantSession(ctx.res, ctx.req, await createApplicantSession({
          applicantId: applicant.applicant_id,
          email,
        }));

        return { applicant: publicApplicant(applicant), message: "Registration successful." };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[ApplicantAuth] Registration failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not create your account. Please try again." });
      }
    }),

    login: publicProcedure.input(credentialsInput).mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase();
      const applicant = await getApplicantByEmail(email);
      if (!applicant?.password_hash || !(await verifyPassword(input.password, applicant.password_hash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      }

      setApplicantSession(ctx.res, ctx.req, await createApplicantSession({
        applicantId: applicant.applicant_id,
        email,
      }));

      return { applicant: publicApplicant(applicant), message: "Login successful." };
    }),

    me: publicProcedure.query(async ({ ctx }) => {
      const session = await readApplicantSession(ctx.req);
      if (!session) return null;

      const applicant = await getApplicantByEmail(session.email);
      if (!applicant || applicant.applicant_id !== session.applicantId) {
        clearApplicantSession(ctx.res, ctx.req);
        return null;
      }

      return {
        ...publicApplicant(applicant),
        currentAdmissionStatus: await getLatestAdmissionStatus(applicant.applicant_id),
      };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearApplicantSession(ctx.res, ctx.req);
      return { success: true } as const;
    }),
  }),

  admissionApplication: router({
    options: publicProcedure.query(async () => ({
      campuses: await getCampuses(),
      programs: await getPrograms(),
    })),

    status: publicProcedure.query(async ({ ctx }) => {
      const session = await readApplicantSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to view your application status." });
      return getLatestAdmissionDetail(session.applicantId);
    }),

    programsByCampus: publicProcedure.input(z.object({ campusId: z.number().int().positive() })).query(({ input }) => getProgramsForCampus(input.campusId)),

    submit: publicProcedure.input(admissionSubmitInput).mutation(async ({ input, ctx }) => {
      const session = await readApplicantSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to submit an application." });

      const requiredDocuments = requiredDocumentsByType[input.applicationType];
      const submittedTypes = new Set(input.documents.map(document => document.docType));
      const missingDocuments = requiredDocuments.filter(documentType => !submittedTypes.has(documentType));
      if (missingDocuments.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Please upload: ${missingDocuments.join(", ")}.` });
      }

      try {
        await ensureDocumentBucket();
        const email = input.email.toLowerCase();
        await updateApplicantProfile({ applicantId: session.applicantId, ...input, email });
        const application = await createAdmissionApplication({
          applicantId: session.applicantId,
          campusId: input.campusId,
          programId: input.programId,
          applicationType: input.applicationType,
          strand: input.strand,
          prevSchool: input.prevSchool,
          prevSchoolAddress: input.prevSchoolAddress,
          schoolType: input.schoolType,
          yearGraduated: input.yearGraduated,
          gwa: input.gwa,
          honors: input.honors,
          examType: input.examType,
          examDate: input.examDate,
          examTimeSlot: input.examTimeSlot,
          examVenue: input.examVenue,
        });
        if (!application) throw new Error("Admission application was not returned after submission");

        const uploadedDocuments = await Promise.all(input.documents.map(async document => ({
          ...document,
          filePath: await uploadAdmissionDocument({
            admissionId: application.admission_id,
            fileName: document.fileName,
            contentType: document.contentType,
            contentBase64: document.contentBase64,
          }),
        })));

        await insertAdmissionDocuments(uploadedDocuments.map(document => ({
          admissionId: application.admission_id,
          docType: document.docType,
          fileName: document.fileName,
          fileSizeBytes: document.fileSizeBytes,
          filePath: document.filePath,
        })));

        setApplicantSession(ctx.res, ctx.req, await createApplicantSession({
          applicantId: session.applicantId,
          email,
        }));

        return { admissionId: application.admission_id, status: "Pending" as const };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[AdmissionApplication] Submission failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not submit your application. Please try again." });
      }
    }),
  }),

  enrollment: router({
    options: publicProcedure.query(async ({ ctx }) => {
      const session = await readApplicantSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to continue." });
      const approvedAdmission = await getLatestApprovedAdmission(session.applicantId);
      if (!approvedAdmission) throw new TRPCError({ code: "FORBIDDEN", message: "Online enrollment is available only after admission approval." });
      return {
        admissionId: approvedAdmission.admission_id,
        programId: approvedAdmission.program_id,
        subjects: await getCourseSubjectsForProgram(approvedAdmission.program_id),
      };
    }),

    submit: publicProcedure.input(enrollmentSubmitInput).mutation(async ({ input, ctx }) => {
      const session = await readApplicantSession(ctx.req);
      if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to continue." });
      const approvedAdmission = await getLatestApprovedAdmission(session.applicantId);
      if (!approvedAdmission) throw new TRPCError({ code: "FORBIDDEN", message: "Online enrollment is available only after admission approval." });

      try {
        const enrollmentRefCode = `ENR-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        const enrollment = await createEnrollment({
          applicantId: session.applicantId,
          admissionId: approvedAdmission.admission_id,
          campusId: approvedAdmission.campus_id,
          programId: approvedAdmission.program_id,
          previousSchool: input.previousSchool || approvedAdmission.previous_school || "",
          enrollmentRefCode,
          insuranceRefNumber: input.insuranceRefNumber,
        });
        if (!enrollment) throw new Error("Enrollment was not returned after submission");

        await createEmergencyContact({ enrollmentId: enrollment.enrollment_id, ...input.emergencyContact });
        if (input.scholarship) await createScholarship({ enrollmentId: enrollment.enrollment_id, ...input.scholarship });

        const medicalDocuments = await Promise.all(input.medicalDocuments.map(async document => ({
          ...document,
          filePath: await uploadMedicalDocument({
            enrollmentId: enrollment.enrollment_id,
            fileName: document.fileName,
            contentType: document.contentType,
            contentBase64: document.contentBase64,
          }),
        })));
        await insertMedicalDocuments(medicalDocuments.map(document => ({
          enrollmentId: enrollment.enrollment_id,
          docType: document.docType,
          fileName: document.fileName,
          fileSizeBytes: document.fileSizeBytes,
          filePath: document.filePath,
        })));
        await insertEnrollmentSubjects(enrollment.enrollment_id, input.subjectCodes);

        return { enrollmentId: enrollment.enrollment_id, enrollmentRefCode, paymentStatus: "Unpaid" as const };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Enrollment] Submission failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not submit your enrollment. Please try again." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
