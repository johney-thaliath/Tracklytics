const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Database
const db = new sqlite3.Database("./tracklytics.db");

// Create table
db.run(`CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL,
  category TEXT,
  date TEXT,
  notes TEXT,
  accountId TEXT
)`);

// Add expense
app.post("/add-expense", (req, res) => {
  const { amount, category, date, notes, accountId } = req.body;

  db.run(
    `INSERT INTO expenses (amount, category, date, notes, accountId)
     VALUES (?, ?, ?, ?, ?)`,
    [amount, category, date, notes, accountId],
    function (err) {
      if (err) {
        return res.status(500).json(err);
      }
      res.json({ id: this.lastID });
    }
  );
});

// Get expenses
app.get("/expenses", (req, res) => {
  db.all("SELECT * FROM expenses", [], (err, rows) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(rows);
  });
});

// 🔥 ADD THIS PART BELOW
app.delete("/delete-expense/:id", (req, res) => {
  const id = parseInt(req.params.id);

  db.run("DELETE FROM expenses WHERE id = ?", [id], function (err) {
    if (err) {
      return res.status(500).json(err);
    }
    res.json({ message: "Deleted successfully" });
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
