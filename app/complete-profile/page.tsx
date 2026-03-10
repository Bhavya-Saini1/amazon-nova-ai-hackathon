import { requireIncompleteProfile } from '@/lib/auth-guards';
import { CompleteProfileForm } from '@/components/CompleteProfileForm';

export default async function CompleteProfilePage() {
  const { user } = await requireIncompleteProfile();

  return (
    <CompleteProfileForm
      initialValues={{
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        username: user.username ?? '',
        age: user.age ?? null,
        phone_number: user.phone_number ?? '',
        email: user.email,
      }}
    />
  );
}