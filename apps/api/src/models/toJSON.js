/** Shared toJSON options: expose `id`, hide `_id`, `__v` and any secrets. */
export const toJSON = {
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.passwordHash;
    delete ret.googleId;
    return ret;
  },
};
