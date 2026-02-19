const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ---------------- middlewares ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "loja-prata",
    resave: false,
    saveUninitialized: false,
  })
);

/* ---------------- pastas públicas ---------------- */

app.use("/public", express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* ---------------- garante pasta uploads ---------------- */

if (!fs.existsSync("public/uploads")) {
  fs.mkdirSync("public/uploads", { recursive: true });
}

/* ---------------- banco ---------------- */

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      image TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* ---------------- multer ---------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Arquivo não é imagem"));
    }
    cb(null, true);
  },
});

/* ---------------- middlewares de proteção ---------------- */

function auth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).send("Você precisa estar logado");
  }
  next();
}

function adminOnly(req, res, next) {
  db.get(
    "SELECT role FROM users WHERE id = ?",
    [req.session.userId],
    (err, user) => {
      if (err || !user || user.role !== "admin") {
        return res.status(403).send("Apenas administrador");
      }
      next();
    }
  );
}

/* ---------------- páginas ---------------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views/register.html"));
});

app.get("/admin", auth, adminOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "views/admin.html"));
});

/* ---------------- API usuários ---------------- */

app.post("/api/users", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("Dados obrigatórios");
  }

  if (password.length < 6) {
    return res.status(400).send("Senha deve ter no mínimo 6 caracteres");
  }

  const hash = await bcrypt.hash(password, 12);

  db.run(
    "INSERT INTO users (name,email,password) VALUES (?,?,?)",
    [name.trim(), email.trim().toLowerCase(), hash],
    function (err) {
      if (err) {
        return res.status(409).send("Email já cadastrado");
      }

      res.status(201).send("Usuário criado com sucesso");
    }
  );
});

/* ---------------- login ---------------- */

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Dados inválidos");
  }

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email.toLowerCase()],
    async (err, user) => {
      if (!user) {
        return res.status(401).send("Login inválido");
      }

      const ok = await bcrypt.compare(password, user.password);

      if (!ok) {
        return res.status(401).send("Login inválido");
      }

      req.session.userId = user.id;

      res.send("Login realizado com sucesso");
    }
  );
});

/* ---------------- cadastrar produto ---------------- */

app.post(
  "/api/products",
  auth,
  adminOnly,
  upload.single("image"),
  (req, res) => {
    console.log("REQ BODY:", req.body);
    console.log("REQ FILE:", req.file);

    const { name, price } = req.body;

    if (!name || !price || !req.file) {
      return res.status(400).send("Dados inválidos");
    }

    const value = Number(price);

    if (isNaN(value) || value <= 0) {
      return res.status(400).send("Preço inválido");
    }

    db.run(
      "INSERT INTO products (name, price, image) VALUES (?, ?, ?)",
      [name.trim(), value, req.file.filename],
      function (err) {
        if (err) {
          console.log(err);
          return res.status(500).send("Erro ao salvar produto");
        }

        res.redirect("/admin");
      }
    );
  }
);

/* ---------------- listar produtos ---------------- */

app.get("/api/products", (req, res) => {
  db.all(
    "SELECT id, name, price, image FROM products ORDER BY created_at DESC",
    (err, rows) => {
      if (err) {
        return res.json([]);
      }

      res.json(rows);
    }
  );
});

/* ---------------- servidor ---------------- */

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
