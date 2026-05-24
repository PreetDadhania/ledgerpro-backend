const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');

function validate(req, res) {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(400).json({ message: e.array()[0].msg });
  return null;
}

// POST /api/payments
router.post('/', auth, [
  body('customerId').notEmpty().withMessage('Customer ID required'),
  body('mode').trim().notEmpty().withMessage('Payment mode required'),
  body('amount').isNumeric({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('date').notEmpty().withMessage('Date required'),
], async (req, res) => {
  const e = validate(req, res); if (e) return;
  try {
    const customer = await Customer.findOne({ _id: req.body.customerId, userId: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const payment = await Payment.create({
      userId: req.user._id,
      customerId: req.body.customerId,
      mode: req.body.mode,
      amount: Number(req.body.amount),
      date: req.body.date,
      note: req.body.note || '',
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/payments/:id
router.put('/:id', auth, [
  body('mode').trim().notEmpty().withMessage('Payment mode required'),
  body('amount').isNumeric({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('date').notEmpty().withMessage('Date required'),
], async (req, res) => {
  const e = validate(req, res); if (e) return;
  try {
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { mode: req.body.mode, amount: Number(req.body.amount), date: req.body.date, note: req.body.note || '' },
      { new: true }
    );
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
