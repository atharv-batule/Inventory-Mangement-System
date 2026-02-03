import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import connectDb from "../database/index.js";
import bcrypt from "bcrypt";
import path from "path";
import session from "express-session";
import collection from "./registration.model.js";
import productCollection from "./product.model.js";
import Inventory from './Inventory.model.js';
import Vendor from './vendor.model.js';
import Invoice from './invoice.model.js'; // Import Invoice model

dotenv.config({ path: "./env" });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true in production with HTTPS
  })
);

console.log("Server is starting...");

connectDb();

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("public"));

// ============== AUTHENTICATION ROUTES ==============

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

// ============== PRODUCT ROUTES ==============

app.get("/products", (req, res) => {
  res.render("product");
});

app.get("/product", async (req, res) => {
  try {
    const products = await productCollection.find({});
    res.render("product", { products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/add-product', async (req, res) => {
  const { product_id, name, description, price, gst, category } = req.body;
  try {
    await productCollection.create({ product_id, name, description, price, gst, category });
    res.redirect('/product');
  } catch (error) {
    console.log(error);
    res.status(500).send('Error adding product');
  }
});

// ============== INVENTORY ROUTES ==============

app.get("/Inventory", async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.render("Inventory", { inventory });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

app.get('/inventory', async (req, res) => {
  try {
    const inventory = await Inventory.find();
    console.log(inventory);
    res.render('Inventory', { inventory });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// ============== VENDOR ROUTES ==============

app.get("/vendor", async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.render("vendor", { vendors });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading vendor page");
  }
});

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
    res.redirect('/vendor');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding vendor');
  }
});

app.post('/delete-vendor/:id', async (req, res) => {
  const vendorId = req.params.id;

  try {
    await Vendor.findByIdAndDelete(vendorId);
    res.redirect('/vendor');
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).send('Failed to delete vendor');
  }
});

app.post('/update-vendor', async (req, res) => {
  const { vendorId, name, email, contact, gstId } = req.body;

  try {
    const updatedVendor = await Vendor.findByIdAndUpdate(vendorId, {
      name,
      email,
      contact,
      gstId
    }, { new: true });

    res.redirect('/vendor');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating vendor');
  }
});

// ============== INVOICE ROUTES ==============

// Helper function to generate unique invoice number
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
}

// Display invoice list page
app.get("/invoice", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.render("invoice-list", { invoices });
  } catch (error) {
    console.error("Error loading invoices:", error);
    res.status(500).send("Error loading invoices page");
  }
});

// Display invoice creation page
app.get("/invoice/create", async (req, res) => {
  try {
    res.render("invoice-create");
  } catch (error) {
    console.error("Error loading invoice creation page:", error);
    res.status(500).send("Error loading page");
  }
});

// Display invoice edit page
app.get("/invoice/edit/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).send("Invoice not found");
    }
    res.render("invoice-edit", { invoice });
  } catch (error) {
    console.error("Error loading invoice edit page:", error);
    res.status(500).send("Error loading page");
  }
});

// Display invoice detail/view page (optional)
app.get("/invoice/view/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).send("Invoice not found");
    }
    res.render("invoice-view", { invoice }); // You'll need to create this view
  } catch (error) {
    console.error("Error loading invoice view page:", error);
    res.status(500).send("Error loading page");
  }
});

// ============== INVOICE API ROUTES ==============

// Get all invoices (API endpoint)
app.get("/api/invoices", async (req, res) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { vendorName: { $regex: search, $options: 'i' } },
        { vendorEmail: { $regex: search, $options: 'i' } }
      ];
    }
    
    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get single invoice by ID (API endpoint)
app.get("/api/invoices/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get invoice statistics (API endpoint)
app.get("/api/invoices/stats/summary", async (req, res) => {
  try {
    const stats = await Invoice.getInvoiceStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching invoice stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Create new invoice
app.post("/api/invoices/create", async (req, res) => {
  try {
    const { vendorId, status, items, subtotal, gstTotal, total, notes, dueDate } = req.body;

    // Find vendor details
    const vendor = await Vendor.findOne({ vendorId });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Generate unique invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      vendorId,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      vendorGstId: vendor.gstId,
      items,
      subtotal,
      gstTotal,
      total,
      status: status || 'Draft',
      notes,
      dueDate: dueDate ? new Date(dueDate) : null
    });

    console.log("Invoice created:", invoice);
    res.status(201).json({ message: "Invoice created successfully", invoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ message: "Error creating invoice", error: error.message });
  }
});

// Update invoice
app.put("/api/invoices/:id", async (req, res) => {
  try {
    const { status, items, subtotal, gstTotal, total, notes, dueDate } = req.body;
    
    const updateData = {
      items,
      subtotal,
      gstTotal,
      total,
      status,
      notes,
      updatedAt: Date.now()
    };
    
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }
    
    // If status is being set to Paid, record the paid date
    if (status === 'Paid') {
      updateData.paidDate = new Date();
    }
    
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({ message: "Invoice updated successfully", invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ message: "Error updating invoice" });
  }
});

// Update invoice status only
app.patch("/api/invoices/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    const updateData = { status };
    
    // If status is being set to Paid, record the paid date
    if (status === 'Paid') {
      updateData.paidDate = new Date();
    }
    
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({ message: "Invoice status updated successfully", invoice });
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({ message: "Error updating invoice status" });
  }
});

// Delete invoice
app.delete("/api/invoices/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ message: "Error deleting invoice" });
  }
});

// Duplicate/Clone invoice
app.post("/api/invoices/:id/duplicate", async (req, res) => {
  try {
    const originalInvoice = await Invoice.findById(req.params.id);
    
    if (!originalInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Create a new invoice based on the original
    const newInvoiceNumber = generateInvoiceNumber();
    
    const duplicateInvoice = await Invoice.create({
      invoiceNumber: newInvoiceNumber,
      vendorId: originalInvoice.vendorId,
      vendorName: originalInvoice.vendorName,
      vendorEmail: originalInvoice.vendorEmail,
      vendorGstId: originalInvoice.vendorGstId,
      items: originalInvoice.items,
      subtotal: originalInvoice.subtotal,
      gstTotal: originalInvoice.gstTotal,
      total: originalInvoice.total,
      status: 'Draft',
      notes: originalInvoice.notes
    });

    res.status(201).json({ 
      message: "Invoice duplicated successfully", 
      invoice: duplicateInvoice 
    });
  } catch (error) {
    console.error("Error duplicating invoice:", error);
    res.status(500).json({ message: "Error duplicating invoice" });
  }
});

// Export invoice to PDF (placeholder - you'll need to implement PDF generation)
app.get("/api/invoices/:id/export/pdf", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // TODO: Implement PDF generation using a library like PDFKit or Puppeteer
    res.json({ 
      message: "PDF export not yet implemented", 
      invoice 
    });
  } catch (error) {
    console.error("Error exporting invoice:", error);
    res.status(500).json({ message: "Error exporting invoice" });
  }
});

// ============== API ENDPOINTS FOR VENDORS AND PRODUCTS ==============

app.get("/api/vendors", async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await productCollection.find();
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// ============== PRODUCT UPDATE & DELETE ROUTES ==============

// Update product
app.post('/update-product', async (req, res) => {
  const { productId, product_id, name, description, price, gst, category } = req.body;
  
  try {
    await productCollection.findByIdAndUpdate(
      productId,
      {
        product_id,
        name,
        description,
        price,
        gst,
        category
      },
      { new: true }
    );
    res.redirect('/product');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Error updating product');
  }
});

// Delete product
app.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    await productCollection.findByIdAndDelete(productId);
    res.redirect('/product');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Failed to delete product');
  }
});

// ============== SERVER START ==============

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});