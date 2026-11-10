import { AuthShell } from "@/app/ui/auth";
import PasswordResetForm from "@/app/ui/password-reset";

export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const isCompleting = typeof token === "string" && token.length > 0;

  return (
    <AuthShell
      title={isCompleting ? "Buat Kata Sandi Baru" : "Reset Password"}
      subtitle={
        isCompleting
          ? "Masukkan kata sandi baru untuk akun Anda"
          : "Masukkan email akun untuk menerima tautan reset"
      }
    >
      <PasswordResetForm token={isCompleting ? token : undefined} />
    </AuthShell>
  );
}