import { AuthShell, ProfileForm } from "@/app/ui/auth";

export default function CompleteProfilePage() {
  return (
    <AuthShell
      title="Lengkapi Profil"
      subtitle={
        <>
          Lengkapi data pelanggan untuk
          <br />
          melanjutkan pemesanan Kerupuk Azizah
        </>
      }
    >
      <ProfileForm />
    </AuthShell>
  );
}
