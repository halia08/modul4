import { AuthShell, LoginForm } from "@/app/ui/auth";

export default function LoginPage() {
  return (
    <AuthShell
      title="Masuk ke Akun"
      subtitle={
        <>
          Masuk Untuk Melanjutkan Belanja
          <br />
          Mengakses Semua Fitur Kerupuk Azizah
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
