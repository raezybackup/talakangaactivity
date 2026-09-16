import { FormEvent, useMemo, useState } from "react";
import { trpc } from "./lib/trpc";

type Mode = "home" | "apply" | "status" | "enroll";
type DocumentPayload = { docType: string; fileName: string; fileSizeBytes: number; contentType: string; contentBase64: string };

const applicationTypes = ["Freshmen", "Transferee", "Ladderized"] as const;
const requiredDocs: Record<(typeof applicationTypes)[number], string[]> = {
  Freshmen: ["Form 138/Report Card", "PSA Birth Certificate", "Good Moral Certificate", "2x2 Photo"],
  Transferee: ["Transcript of Records", "Honorable Dismissal/Transfer Credential", "Good Moral Certificate", "PSA Birth Certificate", "2x2 Photo"],
  Ladderized: ["Certificate/Diploma from previous ladder level", "Transcript of Records", "Good Moral Certificate", "PSA Birth Certificate", "2x2 Photo"],
};

function Field({ label, name, value, onChange, type = "text", required = true }: { label: string; name: string; value: string | number; onChange: (name: string, value: string) => void; type?: string; required?: boolean }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} value={value} required={required} onChange={e => onChange(name, e.target.value)} /></label>;
}

function App() {
  const [mode, setMode] = useState<Mode>("home");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const me = trpc.applicantAuth.me.useQuery();
  const logout = trpc.applicantAuth.logout.useMutation({ onSuccess: () => me.refetch() });

  return <div className="app-shell">
    <header className="topbar"><div><p className="eyebrow">STUDENT SERVICES</p><h1>Admission & Enrollment Portal</h1></div><nav>
      <button className="nav-button" onClick={() => setMode("home")}>Home</button>
      {me.data ? <><button className="nav-button" onClick={() => setMode("apply")}>Apply</button><button className="nav-button" onClick={() => setMode("status")}>Status</button><button className="nav-button" onClick={() => setMode("enroll")}>Enrollment</button><button className="nav-button" onClick={() => logout.mutate()}>Sign out</button></> : <button className="nav-button primary" onClick={() => setAuthMode("login")}>Applicant sign in</button>}
    </nav></header>
    <main className="content">{mode === "home" && <Home me={me.data} onStart={() => me.data ? setMode("apply") : setAuthMode("login")} />}{!me.data && authMode && <AuthPanel mode={authMode} setMode={setAuthMode} onDone={() => { me.refetch(); setAuthMode("login"); }} />}{me.data && mode === "apply" && <ApplicationForm onDone={() => setMode("status")} />}{me.data && mode === "status" && <StatusPanel />}{me.data && mode === "enroll" && <EnrollmentForm />}</main>
    <footer>Use this portal to submit an application, monitor its status, and complete enrollment after approval.</footer>
  </div>;
}

function Home({ me, onStart }: { me: any; onStart: () => void }) {
  return <section className="hero"><div className="hero-copy"><p className="eyebrow">WELCOME{me ? `, ${me.email}` : ""}</p><h2>Your next chapter starts here.</h2><p>Submit your admission requirements online, track your application, and enroll when your admission is approved.</p><button className="primary large" onClick={onStart}>{me ? "Start an application" : "Get started"}</button></div><div className="steps"><div><b>01</b><span>Create an applicant account</span></div><div><b>02</b><span>Complete your admission form</span></div><div><b>03</b><span>Enroll after approval</span></div></div></section>;
}

function AuthPanel({ mode, setMode, onDone }: { mode: "login" | "register"; setMode: (m: "login" | "register") => void; onDone: () => void }) {
  const [form, setForm] = useState({ email: "", password: "", mobile: "" });
  const [error, setError] = useState("");
  const login = trpc.applicantAuth.login.useMutation({ onSuccess: onDone, onError: e => setError(e.message) });
  const register = trpc.applicantAuth.register.useMutation({ onSuccess: onDone, onError: e => setError(e.message) });
  const submit = (e: FormEvent) => { e.preventDefault(); setError(""); mode === "login" ? login.mutate({ email: form.email, password: form.password }) : register.mutate(form); };
  return <section className="card auth-card"><p className="eyebrow">APPLICANT ACCOUNT</p><h2>{mode === "login" ? "Sign in to continue" : "Create your account"}</h2><form onSubmit={submit}><Field label="Email" name="email" value={form.email} onChange={(n, v) => setForm({ ...form, [n]: v })} type="email" /><Field label="Password" name="password" value={form.password} onChange={(n, v) => setForm({ ...form, [n]: v })} type="password" />{mode === "register" && <Field label="Mobile number" name="mobile" value={form.mobile} onChange={(n, v) => setForm({ ...form, [n]: v })} />}{error && <p className="error">{error}</p>}<button className="primary" disabled={login.isPending || register.isPending}>{mode === "login" ? "Sign in" : "Register"}</button></form><button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "New applicant? Create an account" : "Already registered? Sign in"}</button></section>;
}

function ApplicationForm({ onDone }: { onDone: () => void }) {
  const options = trpc.admissionApplication.options.useQuery();
  const submit = trpc.admissionApplication.submit.useMutation({ onSuccess: onDone });
  const [type, setType] = useState<(typeof applicationTypes)[number]>("Freshmen");
  const [campusId, setCampusId] = useState(""); const [programId, setProgramId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ lrn: "", lastName: "", firstName: "", middleName: "", suffix: "", sex: "", civilStatus: "", birthDate: "", email: "", mobile: "", region: "", province: "", city: "", barangay: "", strand: "", prevSchool: "", prevSchoolAddress: "", schoolType: "", yearGraduated: "2025", gwa: "", honors: "", examType: "Entrance Exam", examDate: "", examTimeSlot: "", examVenue: "" });
  const [docs, setDocs] = useState<DocumentPayload[]>([]);
  const programs = trpc.admissionApplication.programsByCampus.useQuery({ campusId: Number(campusId) }, { enabled: Boolean(campusId) });
  const update = (name: string, value: string) => setValues(v => ({ ...v, [name]: value }));
  const addDoc = async (docType: string, file?: File) => { if (!file) return; const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = reject; reader.readAsDataURL(file); }); setDocs(d => [...d.filter(x => x.docType !== docType), { docType, fileName: file.name, fileSizeBytes: file.size, contentType: file.type || "application/octet-stream", contentBase64 }]); };
  const submitForm = (e: FormEvent) => { e.preventDefault(); submit.mutate({ ...values, applicationType: type, campusId: Number(campusId), programId: Number(programId), yearGraduated: Number(values.yearGraduated), gwa: Number(values.gwa), documents: docs } as any); };
  return <section className="card wide"><p className="eyebrow">ADMISSION APPLICATION</p><h2>Complete your application</h2><p className="muted">Fields marked required are needed before submission. Maximum document size is 8 MB.</p><form onSubmit={submitForm}><div className="form-grid"><label className="field"><span>Application type</span><select value={type} onChange={e => setType(e.target.value as any)}>{applicationTypes.map(x => <option key={x}>{x}</option>)}</select></label><Field label="LRN" name="lrn" value={values.lrn} onChange={update} />{["firstName", "middleName", "lastName", "suffix", "sex", "civilStatus", "email", "mobile", "birthDate", "region", "province", "city", "barangay", "strand", "prevSchool", "prevSchoolAddress", "schoolType", "yearGraduated", "gwa", "honors", "examType", "examDate", "examTimeSlot", "examVenue"].map(name => <Field key={name} label={name.replace(/[A-Z]/g, m => ` ${m}`).replace(/^./, m => m.toUpperCase())} name={name} value={values[name]} onChange={update} type={name.toLowerCase().includes("date") ? "date" : "text"} required={!['middleName','suffix','strand','honors'].includes(name)} />)}<label className="field"><span>Campus</span><select required value={campusId} onChange={e => { setCampusId(e.target.value); setProgramId(""); }}><option value="">Choose a campus</option>{options.data?.campuses?.map((c: any) => <option key={c.campus_id} value={c.campus_id}>{c.campus_name}</option>)}</select></label><label className="field"><span>Program</span><select required value={programId} onChange={e => setProgramId(e.target.value)}><option value="">Choose a program</option>{(programs.data || options.data?.programs || []).map((p: any) => <option key={p.program_id} value={p.program_id}>{p.program_name}{p.college ? ` — ${p.college}` : ""}</option>)}</select></label></div><h3>Required documents</h3><div className="documents">{requiredDocs[type].map(doc => <label className="upload" key={doc}><span>{doc}</span><input type="file" required={!docs.some(d => d.docType === doc)} onChange={e => addDoc(doc, e.target.files?.[0])} />{docs.some(d => d.docType === doc) && <small>Attached</small>}</label>)}</div>{submit.error && <p className="error">{submit.error.message}</p>}<button className="primary" disabled={submit.isPending || !options.data}>{submit.isPending ? "Submitting…" : "Submit application"}</button></form></section>;
}

function StatusPanel() {
  const status = trpc.admissionApplication.status.useQuery();
  if (status.isLoading) return <section className="card"><p>Loading application status…</p></section>;
  if (status.error) return <section className="card"><p className="error">{status.error.message}</p></section>;
  const data: any = status.data;
  return <section className="card"><p className="eyebrow">APPLICATION STATUS</p><h2>{data ? `Application #${data.admission_id}` : "No application found"}</h2><div className="status-pill">{data?.status || "Not submitted"}</div><p className="muted">Your latest application status will appear here. Refresh this page after the admissions team updates your record.</p></section>;
}

function EnrollmentForm() {
  const options = trpc.enrollment.options.useQuery();
  const submit = trpc.enrollment.submit.useMutation();
  const [form, setForm] = useState({ previousSchool: "", insuranceRefNumber: "", fullName: "", relationship: "", mobile: "", email: "", scholarshipType: "", scholarshipName: "", grantingBody: "" });
  const [subjectCodes, setSubjectCodes] = useState<string[]>([]);
  const update = (name: string, value: string) => setForm(v => ({ ...v, [name]: value }));
  if (options.isLoading) return <section className="card"><p>Checking enrollment eligibility…</p></section>;
  if (options.error) return <section className="card"><p className="error">{options.error.message}</p></section>;
  const subjects: any[] = options.data?.subjects || [];
  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit.mutate({ previousSchool: form.previousSchool, insuranceRefNumber: form.insuranceRefNumber, emergencyContact: { fullName: form.fullName, relationship: form.relationship, mobile: form.mobile, email: form.email }, scholarship: form.scholarshipName ? { scholarshipType: form.scholarshipType, scholarshipName: form.scholarshipName, grantingBody: form.grantingBody } : null, medicalDocuments: [], subjectCodes }); };
  return <section className="card wide"><p className="eyebrow">ENROLLMENT</p><h2>Complete enrollment</h2><p className="muted">You are eligible to enroll. Select your subjects and provide emergency contact details.</p><form onSubmit={onSubmit}><div className="form-grid"><Field label="Previous school" name="previousSchool" value={form.previousSchool} onChange={update} /><Field label="Insurance reference number" name="insuranceRefNumber" value={form.insuranceRefNumber} onChange={update} required={false} /><Field label="Emergency contact name" name="fullName" value={form.fullName} onChange={update} /><Field label="Relationship" name="relationship" value={form.relationship} onChange={update} /><Field label="Emergency mobile" name="mobile" value={form.mobile} onChange={update} /><Field label="Emergency email" name="email" value={form.email} onChange={update} type="email" /><Field label="Scholarship type" name="scholarshipType" value={form.scholarshipType} onChange={update} required={false} /><Field label="Scholarship name" name="scholarshipName" value={form.scholarshipName} onChange={update} required={false} /><Field label="Granting body" name="grantingBody" value={form.grantingBody} onChange={update} required={false} /></div><h3>Subjects</h3><div className="subject-list">{subjects.map(s => <label key={s.subject_code} className="check"><input type="checkbox" checked={subjectCodes.includes(s.subject_code)} onChange={e => setSubjectCodes(x => e.target.checked ? [...x, s.subject_code] : x.filter(code => code !== s.subject_code))} />{s.subject_code} — {s.subject_name}</label>)}</div>{submit.data && <p className="success">Enrollment submitted. Reference: {submit.data.enrollmentRefCode}</p>}{submit.error && <p className="error">{submit.error.message}</p>}<button className="primary" disabled={submit.isPending || subjectCodes.length === 0}>{submit.isPending ? "Submitting…" : "Submit enrollment"}</button></form></section>;
}

export default App;
