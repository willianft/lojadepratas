const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
const path = require("path");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "loja-prata",
    resave: false,
    saveUninitialized: false,
  }),
);

app.use("/public", express.static("public"));
app.use("/uploads", express.static("public/uploads"));

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
  db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )
    `);

  db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            image TEXT
        )
    `);
});

/* upload */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* rotas páginas */

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/views/login.html");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/views/register.html");
});

app.get("/admin", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  res.sendFile(__dirname + "/views/admin.html");
});

/* usuários */

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (name,email,password) VALUES (?,?,?)",
    [name, email, hash],
    (err) => {
      if (err) return res.send("Erro ao cadastrar");
      res.redirect("/login");
    },
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (!user) return res.send("Usuário não encontrado");

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) return res.send("Senha inválida");

    req.session.userId = user.id;
    res.redirect("/admin");
  });
});

/* produtos */

app.post("/products", upload.single("image"), (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Não autorizado");
  }

  const { name, price } = req.body;
  const image = req.file.filename;

  db.run(
    "INSERT INTO products (name,price,image) VALUES (?,?,?)",
    [name, price, image],
    () => res.redirect("/admin"),
  );
});

app.get("/products", (req, res) => {
  db.all("SELECT * FROM products", (err, rows) => {
    res.json(rows);
  });
});

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
