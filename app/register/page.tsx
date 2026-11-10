import { AuthShell, RegisterForm } from "@/app/ui/auth";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Registrasi Akun"
      subtitle={
        <>
          Daftarkan diri anda dan jadilah bagian dari
          <br />
          Keluarga besar Kerupuk Azizah
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
