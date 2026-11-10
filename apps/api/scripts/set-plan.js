// Turn Premium on or off for one account (until payments exist).
// Usage (from apps/api, with MONGODB_URI pointing at the database to change):
//   node --env-file=../../.env scripts/set-plan.js rider@example.com premium
//   node --env-file=../../.env scripts/set-plan.js rider@example.com free
import mongoose from 'mongoose';
import { User } from '../src/models/index.js';

const [email, plan] = process.argv.slice(2);
if (!email || !['free', 'premium'].includes(plan)) {
  console.error('Usage: node scripts/set-plan.js <email> <free|premium>');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { plan }, { returnDocument: 'after' });
  if (!user) {
    console.error(`No account with the email ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`${user.email} is now on the ${user.plan} plan.`);
  }
} finally {
  await mongoose.disconnect();
}
