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

app.get("/inventory", async (req, res) => {
  try {
    const inventory = await Inventory.find().sort({ created_at: -1 });
    res.render("inventory", { inventory });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Add new inventory item
app.post('/add-inventory', async (req, res) => {
  const { product_id, name, description, price, gst, category, quantity, expiry_date } = req.body;
  
  try {
    // Check if product_id already exists
    const existingItem = await Inventory.findOne({ product_id });
    if (existingItem) {
      return res.status(400).send('Product ID already exists');
    }

    await Inventory.create({ 
      product_id, 
      name, 
      description, 
      price: parseFloat(price),
      gst: parseInt(gst),
      category,
      quantity: parseInt(quantity),
      expiry_date: expiry_date || 'N/A'
    });
    
    res.redirect('/inventory');
  } catch (error) {
    console.error('Error adding inventory item:', error);
    res.status(500).send('Error adding inventory item');
  }
});

// Update inventory item
app.post('/update-inventory', async (req, res) => {
  const { inventoryId, product_id, name, description, price, gst, category, quantity, expiry_date } = req.body;
  
  try {
    // Check if trying to update to a product_id that already exists (but not the same item)
    const existingItem = await Inventory.findOne({ 
      product_id, 
      _id: { $ne: inventoryId } 
    });
    
    if (existingItem) {
      return res.status(400).send('Product ID already exists');
    }

    await Inventory.findByIdAndUpdate(
      inventoryId,
      {
        product_id,
        name,
        description,
        price: parseFloat(price),
        gst: parseInt(gst),
        category,
        quantity: parseInt(quantity),
        expiry_date: expiry_date || 'N/A'
      },
      { new: true, runValidators: true }
    );
    
    res.redirect('/inventory');
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).send('Error updating inventory item');
  }
});

// Delete inventory item
app.post('/delete-inventory/:id', async (req, res) => {
  const inventoryId = req.params.id;

  try {
    const deletedItem = await Inventory.findByIdAndDelete(inventoryId);
    
    if (!deletedItem) {
      return res.status(404).send('Inventory item not found');
    }
    
    res.redirect('/inventory');
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).send('Failed to delete inventory item');
  }
});

// ============== INVENTORY API ROUTES ==============

// Get all inventory items (API endpoint)
app.get("/api/inventory", async (req, res) => {
  try {
    const { category, lowStock, search } = req.query;
    
    const query = {};
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter low stock items (quantity <= 10)
    if (lowStock === 'true') {
      query.quantity = { $lte: 10 };
    }
    
    // Search by product_id, name, or description
    if (search) {
      query.$or = [
        { product_id: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const inventory = await Inventory.find(query).sort({ created_at: -1 });
    res.json(inventory);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get single inventory item by ID (API endpoint)
app.get("/api/inventory/:id", async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    
    res.json(item);
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get inventory statistics (API endpoint)
app.get("/api/inventory/stats/summary", async (req, res) => {
  try {
    const allItems = await Inventory.find();
    
    const stats = {
      totalItems: allItems.length,
      totalStock: allItems.reduce((sum, item) => sum + item.quantity, 0),
      lowStockItems: allItems.filter(item => item.quantity <= 10).length,
      totalValue: allItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      categoryBreakdown: {},
      averagePrice: allItems.length > 0 
        ? allItems.reduce((sum, item) => sum + item.price, 0) / allItems.length 
        : 0
    };
    
    // Calculate category breakdown
    allItems.forEach(item => {
      if (!stats.categoryBreakdown[item.category]) {
        stats.categoryBreakdown[item.category] = {
          count: 0,
          totalQuantity: 0,
          totalValue: 0
        };
      }
      stats.categoryBreakdown[item.category].count++;
      stats.categoryBreakdown[item.category].totalQuantity += item.quantity;
      stats.categoryBreakdown[item.category].totalValue += item.price * item.quantity;
    });
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching inventory stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update inventory quantity (API endpoint) - useful for quick stock adjustments
app.patch("/api/inventory/:id/quantity", async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity < 0) {
      return res.status(400).json({ message: "Quantity cannot be negative" });
    }
    
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { quantity: parseInt(quantity) },
      { new: true, runValidators: true }
    );
    
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    
    res.json({ message: "Quantity updated successfully", item });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ message: "Error updating quantity" });
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
function generateInvoiceId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${random}`;
}

// Display invoice list page
app.get("/invoice", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.render("invoice", { invoices });  // Renders invoice.ejs
  } catch (error) {
    console.error("Error loading invoices:", error);
    res.status(500).send("Error loading invoices page");
  }
});

// Display invoice creation page
app.get("/invoice/create", async (req, res) => {
  try {
    res.render("invoice-create");  // Renders invoice-create.ejs
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
    res.render("invoice-edit", { invoice });  // Renders invoice-edit.ejs
  } catch (error) {
    console.error("Error loading invoice edit page:", error);
    res.status(500).send("Error loading page");
  }
});

// Display invoice detail/view page
app.get("/invoice/view/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).send("Invoice not found");
    }
    res.render("invoice-view", { invoice });  // Renders invoice-view.ejs
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
        { invoiceId: { $regex: search, $options: 'i' } },
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

// Create new invoice - WITH DUPLICATE PREVENTION
app.post("/api/invoices/create", async (req, res) => {
  try {
    const { vendorId, status, items, subtotal, gstTotal, total, notes, dueDate } = req.body;

    // Find vendor details
    const vendor = await Vendor.findOne({ vendorId });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Generate unique invoice number with retry logic
    let invoiceId;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      invoiceId = generateInvoiceId();
      
      // Check if this invoice number already exists
      const existingInvoice = await Invoice.findOne({ invoiceId });
      
      if (!existingInvoice) {
        // Unique number found, break the loop
        break;
      }
      
      attempts++;
      console.log(`Invoice number collision detected. Retry attempt ${attempts}/${maxAttempts}`);
      
      if (attempts >= maxAttempts) {
        return res.status(500).json({ 
          message: "Failed to generate unique invoice number after multiple attempts. Please try again.",
          error: "Invoice number generation failed"
        });
      }
      
      // Small delay before retry to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Create invoice
    const invoice = await Invoice.create({
      invoiceId,
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

    console.log("Invoice created successfully:", invoiceId);
    res.status(201).json({ message: "Invoice created successfully", invoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Invoice number already exists. Please try creating the invoice again.",
        error: "Duplicate invoice number" 
      });
    }
    
    res.status(500).json({ 
      message: "Error creating invoice", 
      error: error.message 
    });
  }
});

// Update invoice - FIXED VERSION
app.put("/api/invoices/:id", async (req, res) => {
  try {
    const { status, items, subtotal, gstTotal, total, notes, dueDate } = req.body;
    
    // First check if invoice exists
    const existingInvoice = await Invoice.findById(req.params.id);
    if (!existingInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    // Prepare update data - DO NOT include invoiceNumber or vendor details
    // These should remain unchanged during edit
    const updateData = {
      items,
      subtotal,
      gstTotal,
      total,
      status,
      updatedAt: Date.now()
    };
    
    // Only update notes if provided
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    // Only update dueDate if provided
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }
    
    // If status is being changed to Paid, record the paid date
    if (status === 'Paid' && existingInvoice.status !== 'Paid') {
      updateData.paidDate = new Date();
    }
    
    // Use $set to update only specified fields
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log("Invoice updated successfully:", invoice.invoiceId);
    res.json({ message: "Invoice updated successfully", invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: "Validation error", 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: "Error updating invoice",
      error: error.message 
    });
  }
});

// Update invoice status only
app.patch("/api/invoices/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    // Check if invoice exists
    const existingInvoice = await Invoice.findById(req.params.id);
    if (!existingInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    
    const updateData = { 
      status,
      updatedAt: Date.now()
    };
    
    // If status is being changed to Paid, record the paid date
    if (status === 'Paid' && existingInvoice.status !== 'Paid') {
      updateData.paidDate = new Date();
    }
    
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({ message: "Invoice status updated successfully", invoice });
  } catch (error) {
    console.error("Error updating invoice status:", error);
    res.status(500).json({ 
      message: "Error updating invoice status",
      error: error.message 
    });
  }
});

// Delete invoice
app.delete("/api/invoices/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log("Invoice deleted:", invoice.invoiceId);
    res.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ message: "Error deleting invoice" });
  }
});

// Duplicate/Clone invoice - WITH DUPLICATE PREVENTION
app.post("/api/invoices/:id/duplicate", async (req, res) => {
  try {
    const originalInvoice = await Invoice.findById(req.params.id);
    
    if (!originalInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Generate unique invoice number with retry logic
    let newInvoiceId;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      newInvoiceId = generateInvoiceNumber();
      
      const existingInvoice = await Invoice.findOne({ invoiceId: newInvoiceId });
      
      if (!existingInvoice) {
        break;
      }
      
      attempts++;
      console.log(`Duplicate invoice number collision. Retry attempt ${attempts}/${maxAttempts}`);
      
      if (attempts >= maxAttempts) {
        return res.status(500).json({ 
          message: "Failed to generate unique invoice number. Please try again." 
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const duplicateInvoice = await Invoice.create({
      invoiceId: newInvoiceId,
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

    console.log("Invoice duplicated successfully:", newInvoiceId);
    res.status(201).json({ 
      message: "Invoice duplicated successfully", 
      invoice: duplicateInvoice 
    });
  } catch (error) {
    console.error("Error duplicating invoice:", error);
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Failed to duplicate invoice. Please try again.",
        error: "Duplicate invoice number" 
      });
    }
    
    res.status(500).json({ 
      message: "Error duplicating invoice",
      error: error.message 
    });
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

const port = process.env.PORT || 8001;

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});