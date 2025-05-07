import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import connectDb from "../database/index.js";
import bcrypt from "bcrypt";
import path from "path";
import session from "express-session"; // Added for session
import collection from "./registration.model.js";
import productCollection from "./product.model.js";
import Inventory from './Inventory.model.js'; // adjust path accordingly
import Vendor from './vendor.model.js'
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
// app.get('/products', (req, res) => {
//   const products = [
//     { product_id: 'P001', name: 'Product 1' },
//     { product_id: 'P002', name: 'Product 2' },
//   ];
  
//   res.render('product', { products }); // <-- products passed here
// });


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

app.get("/products", (req, res) => {
  res.render("product"); // Assuming product.ejs exists in the 'views' folder
});


const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
//product:
// Updated route for '/products'
app.get("/product", async (req, res) => {
  try {
    const products = await productCollection.find({}); // fetch from MongoDB
    res.render("product", { products }); // pass products here
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/add-product', async (req, res) => {
  const { product_id, name, description, price, gst, category } = req.body;
  try {
      await productCollection.create({ product_id, name, description, price, gst, category });
      res.redirect('/product'); // redirect to '/product' if that page exists
  } catch (error) {
      console.log(error);
      res.status(500).send('Error adding product');
  }
});

app.get("/Inventory", (req, res) => {
  res.render("Inventory"); // Assuming product.ejs exists in the 'views' folder
});


app.get('/inventory', async (req, res) => {
  try {
    const inventory = await Inventory.find(); // fetch all inventory items
    console.log(inventory);  // This will show if we have data in the console
    res.render('Inventory', { inventory });  // sending 'products' to EJS
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Render vendor page with list
app.get("/vendor", async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.render("vendor", { vendors }); // Pass vendors to your EJS template
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading vendor page");
  }
});

// Handle form submission
app.post('/add-vendor', async (req, res) => {
  const { vendorId, name, email, contact, gstId } = req.body;

  const newVendor = {
    vendorId,
    name,
    email,
    contact,
    gstId
  };

  try {
    await Vendor.create(newVendor);
    res.redirect('/vendor'); // Redirects back to form+list view
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding vendor');
  }
});

app.post('/delete-vendor/:id', async (req, res) => {
  const vendorId = req.params.id;

  try {
    await Vendor.findByIdAndDelete(vendorId);
    res.redirect('/vendor'); // or wherever your vendor list is rendered
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).send('Failed to delete vendor');
  }
});

// POST route to handle form submission from modal
app.post('/update-vendor', async (req, res) => {
  const { vendorId, name, email, contact, gstId } = req.body;

  try {
    // Update vendor in the database
    const updatedVendor = await Vendor.findByIdAndUpdate(vendorId, {
      name,
      email,
      contact,
      gstId
    }, { new: true });

    // Send success message or redirect
    res.redirect('/vendor'); // You can redirect to the vendor list page or reload the current page
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating vendor');
  }
});



app.get("/invoice", async (req, res) => {
  try {
   // const vendors = await Vendor.find();
    res.render("invoice"); // Pass vendors to your EJS template
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading vendor page");
  }
});

app.get("/api/vendors", async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.json(vendors); // Send JSON instead of rendering EJS
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await productCollection.find();
    res.json(products); // Send JSON
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
