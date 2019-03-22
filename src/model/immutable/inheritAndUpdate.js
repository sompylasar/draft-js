function inheritAndUpdate<T: Object>(obj: T, update: $Shape<T>): T {
  // Use the original object as a prototype via `Object.create`. Assign new values to properties via `Objrct.assign`.
  return Object.assign(Object.create(obj), update);
}

module.exports = inheritAndUpdate;
module.exports.default = inheritAndUpdate;
module.exports.inheritAndUpdate = inheritAndUpdate;
