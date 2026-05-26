const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String, required: [true, 'Name is required'],
      trim: true, minlength: [2, 'Min 2 chars'], maxlength: [50, 'Max 50 chars'],
    },
    email: {
      type: String, required: [true, 'Email is required'],
      unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password: {
      type: String, required: [true, 'Password is required'],
      minlength: [6, 'Min 6 chars'], select: false,
    },
    isVerified:   { type: Boolean, default: true }, // always true — no email verification
    businessName: { type: String, trim: true, default: '' },
    // keep these fields so old users with tokens still work
    verifyToken:       String,
    verifyTokenExpiry: Date,
    resetToken:        String,
    resetTokenExpiry:  Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
