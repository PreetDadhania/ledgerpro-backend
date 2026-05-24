const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    extraMoney: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
    },
    date: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Auto-calculate total before save
transactionSchema.pre('save', function (next) {
  this.total = this.quantity * this.pricePerUnit + this.extraMoney;
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
