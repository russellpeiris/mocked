import express from "express";
import mongoose from "mongoose";

const app = express();
app.use(express.json());

// Connect to MongoDB
const DBconnect = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://admin:admin@cluster0.db1t8.mongodb.net/"
    );
    console.log("connected to mongodb");
  } catch (error) {
    console.log("error connecting to mongodb", error);
  }
};

app.listen(3000, () => {
  console.log("server is running on port 3000");
  DBconnect();
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  region: { type: String, required: true },
  password: { type: String, required: true },
  userRole: { type: String, default: "user" },
  isActivated: { type: Boolean, default: false },
});

const User = mongoose.model("User", userSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  description: String,
  category: String,
  imageUrl: String,
  feedback: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feedback" }],
});

const Product = mongoose.model("Product", productSchema);

// Cart Schema
const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  quantity: { type: Number, default: 1 },
});

const Cart = mongoose.model("Cart", cartSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  email: String,
  productId: String,
  comment: String,
  rating: Number,
});

const Feedback = mongoose.model("Feedback", feedbackSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: Number,
    },
  ],
  totalAmount: Number,
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
});

const Order = mongoose.model("Order", orderSchema);

// Register Endpoint
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, address, city, region, password, userRole } = req.body;

    if (!name || !email || !address || !city || !region || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists." });
    }

    const user = await User.create({
      name,
      email,
      address,
      city,
      region,
      password,
      userRole,
    });
    res.status(201).json({ message: "User created successfully", data: user });
  } catch (error) {
    res.status(500).json({ message: "Server error, please try again later." });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    //check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "user not found",
      });
    }

    //check if password is correct

    if (password !== user.password) {
      return res.status(401).json({
        status: "error",
        message: "incorrect password",
      });
    }

    // check if user activated
    // if (!user.isActivated) {
    //     return res.status(401).json({
    //         status: "error",
    //         message: "user account not activated",
    //     });
    // }

    //return with success message

    res.status(200).json({
      message: "user logged in successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        city: user.city,
        region: user.region,
        userRole: user.userRole,
        isActivated: user.isActivated,
      },
    });
  } catch (error) {
    console.log("error logging in user", error);
  }
});

// Get all Products and product feedback
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find()
    res
      .status(200)
      .json({ message: "Products retrieved successfully", data: products });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products" });
  }
});


// Add to Cart
app.post("/cart", async (req, res) => {
  try {
    const { email, productId } = req.body;
    const cartItem = await Cart.create({ email, product: productId });

    res
      .status(201)
      .json({ message: "Product added to cart successfully", data: cartItem });
  } catch (error) {
    res.status(500).json({ message: "Error adding product to cart" });
  }
});

// Get Cart by User
app.get("/cart", async (req, res) => {
  try {
    const { email } = req.query;
    const cartItems = await Cart.find({ email }).populate("product");

    res.status(200).json({ message: "Cart items retrieved", data: cartItems });
  } catch (error) {
    res.status(500).json({ message: "Error fetching cart items" });
  }
});

// Leave Feedback on Product
app.post("/product-feedback", async (req, res) => {
  try {
    const { email, productId, comment, rating } = req.body;
    console.log(' req.body :',  req.body);
    const feedback = await Feedback.create({
      email,
      productId,
      comment,
      rating,
    });

    res
      .status(201)
      .json({ message: "Feedback added successfully", data: feedback });
  } catch (error) {
    res.status(500).json({ message: "Error adding feedback" });
  }
});

// Get Feedback by product id and email
app.get("/product-feedback", async (req, res) => {
  try {
    const { productId, email } = req.query;

    // Validate query parameters
    if (!productId || !email) {
      return res.status(400).json({ message: "productId and email are required" });
    }

    // Find feedback by productId and email
    const feedback = await Feedback.findOne({ productId, email });

    // Check if feedback was found
    if (!feedback) {
      return res.status(404).json({ message: "No feedback found for this product and email" });
    }

    res.status(200).json({
      message: "Feedback retrieved successfully",
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching feedback", error: error.message });
  }
});


// Place Order
app.post("/orders", async (req, res) => {
  try {
    const { email } = req.body;
    const cartItems = await Cart.find({ email }).populate("product");

    if (!cartItems.length) {
      return res
        .status(400)
        .json({ message: "No items in cart to place order" });
    }

    let totalAmount = 0;
    const products = cartItems.map((item) => {
      totalAmount += item.product.price;
      return {
        productId: item.product._id,
      };
    });

    const order = await Order.create({ email, products, totalAmount });
    await Cart.deleteMany({ email });

    res.status(201).json({ message: "Order placed successfully", data: order });
  } catch (error) {
    res.status(500).json({ message: "Error placing order" });
  }
});

// Get Orders by User
app.get("/orders", async (req, res) => {
  try {
    const { email } = req.query;
    const orders = await Order.find({ email }).populate("products.productId");

    res
      .status(200)
      .json({ message: "Orders retrieved successfully", data: orders });
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders" });
  }
});
