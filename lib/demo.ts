import { connectDB } from '@/lib/db/mongodb';
import {
  DEMO_AUTH0_ID,
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_USERNAME,
} from '@/lib/demo-shared';
import { User } from '@/lib/models/User';
import { hasCompleteProfile } from '@/lib/profile';

export {
  DEMO_AUTH0_ID,
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_USERNAME,
  getDemoClientUser,
  getDemoSessionUser,
  isDemoMode,
} from '@/lib/demo-shared';

export async function getOrCreateDemoMongoUser() {
  await connectDB();

  let user = await User.findOne({ auth0_id: DEMO_AUTH0_ID });

  if (!user) {
    user = new User({
      auth0_id: DEMO_AUTH0_ID,
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      first_name: 'Demo',
      last_name: 'User',
      username: DEMO_USERNAME,
      age: 25,
      phone_number: '5555555555',
    });
    await user.save();
    return user;
  }

  if (!hasCompleteProfile(user)) {
    user.first_name = user.first_name || 'Demo';
    user.last_name = user.last_name || 'User';
    user.username = user.username || DEMO_USERNAME;
    user.age = typeof user.age === 'number' ? user.age : 25;
    user.phone_number = user.phone_number || '5555555555';
    user.name = user.name || DEMO_NAME;
    await user.save();
  }

  return user;
}
