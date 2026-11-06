import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDb(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export const isDbConnected = () => mongoose.connection.readyState === 1;
