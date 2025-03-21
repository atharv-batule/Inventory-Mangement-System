import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import connectDb from "../database/index.js";
import bcrypt from "bcrypt";
import path from "path";
import session from "express-session"; // Added for session
import collection from "./registration.model.js";

dotenv.config({ path: "./env" });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// tried entering session but kinda failed
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true in production with HTTPS
  })
);

console.log("Server is starting...");

connectDb();//function to check if the database is connected,imported from database

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("public"));


app.get("/api/login", (req, res) => {
  res.render("login");
});


app.get("/api/signup", (req, res) => {
  res.render("signup");
});


app.post("/api/login", async (req, res) => {
  try {
    const check = await collection.findOne({ email: req.body.email });
    if (!check) return res.send("User not found");

    const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
    if (isPasswordMatch) {
      req.session.user = check;
      console.log("Password match!");
      return res.redirect("/home");
    } else {
      return res.send("Invalid password");
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/api/signup", async (req, res) => {
  console.log("Received POST request at signup");
  console.log("Request body", req.body);

  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const data = {
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      phone: req.body.phone,
      location: req.body.location,
      organization: req.body.organization || "N/A",
      role: req.body.role,
    };

    const userdata = await collection.create(data);
    console.log("User Registered:", userdata);
    res.redirect("/api/login");
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


app.get("/home", (req, res) => {
  if (!req.session.user) return res.redirect("/api/login");
  res.render("home", { user: req.session.user });
});


app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Error logging out");
    res.redirect("/api/login");
  });
});

app.get("/product", (req, res) => {
  res.render("product"); // Assuming product.ejs exists in the 'views' folder
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
