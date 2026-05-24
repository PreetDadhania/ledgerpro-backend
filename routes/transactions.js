const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');

function validate(req, res) {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(400).json({ message: e.array()[0].msg });
  return null;
}

// POST /api/transactions
router.post('/', auth, [
  body('customerId').notEmpty().withMessage('Customer ID required'),
  body('itemName').trim().notEmpty().withMessage('Item name required'),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('pricePerUnit').isNumeric().withMessage('Price must be a number'),
  body('date').notEmpty().withMessage('Date required'),
], async (req, res) => {
  const e = validate(req, res); if (e) return;
  try {
    // Ensure customer belongs to this user
    const customer = await Customer.findOne({ _id: req.body.customerId, userId: req.user._id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const txn = new Transaction({
      userId: req.user._id,
      customerId: req.body.customerId,
      itemName: req.body.itemName,
      quantity: Number(req.body.quantity),
      pricePerUnit: Number(req.body.pricePerUnit),
      extraMoney: Number(req.body.extraMoney) || 0,
      date: req.body.date,
      note: req.body.note || '',
    });
    await txn.save();
    res.status(201).json(txn);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', auth, [
  body('itemName').trim().notEmpty().withMessage('Item name required'),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('pricePerUnit').isNumeric().withMessage('Price must be a number'),
  body('date').notEmpty().withMessage('Date required'),
], async (req, res) => {
  const e = validate(req, res); if (e) return;
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    txn.itemName = req.body.itemName;
    txn.quantity = Number(req.body.quantity);
    txn.pricePerUnit = Number(req.body.pricePerUnit);
    txn.extraMoney = Number(req.body.extraMoney) || 0;
    txn.date = req.body.date;
    txn.note = req.body.note || '';
    await txn.save(); // triggers pre-save total calculation

    res.json(txn);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const txn = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
