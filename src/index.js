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
  email: String,
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
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
  email: String,
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
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

app.post("/products", async (req, res) => {
  try {
    const { name, price, description, category, imageUrl } = req.body;

    const product = await Product.create({
      name,
      price,
      description,
      category,
      imageUrl,
    });

    res
      .status(201)
      .json({ message: "Product created successfully", data: product });
  } catch (error) {
    res.status(500).json({ message: "Error creating product" });
  }
})

// Get all Products and product feedback
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res
      .status(200)
      .json({ message: "Products retrieved successfully", data: products });
  } catch (error) {
    res.status(500).json({ message: "Error fetching products" });
  }
});

// Add product to cart
app.post("/cart", async (req, res) => {
  try {
    const { email, product } = req.body;

    let cart = await Cart.findOne({ email });

    if (!cart) {
      cart = new Cart({ email, products: [product] });
    } else {
      if (!cart.products.includes(product)) {
        cart.products.push(product);
      } else {
        return res.status(409).json({ message: "Product already in cart" });
      }
    }

    await cart.save();

    res
      .status(201)
      .json({ message: "Product added to cart successfully", data: cart });
  } catch (error) {
    res.status(500).json({ message: "Error adding product to cart" });
  }
});

app.get("/cart", async (req, res) => {
  try {
    const { email } = req.query;

    // Find the user's cart and populate the products array with product details
    const cart = await Cart.findOne({ email }).populate("products");

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    function getTotalAmount(priceString) {
      return parseFloat(priceString.replace("$", ""));
    }

    // Example usage
    const totalAmount = cart.products.reduce((acc, item) => {
      return acc + getTotalAmount(item.price);
    }, 0);

    res.status(200).json({
      message: "Cart fetched successfully",
      data: {
        products: cart.products,
        totalAmount: totalAmount.toFixed(2),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching cart items", error: error.message });
  }
});

// Leave Feedback on Product
app.post("/product-feedback", async (req, res) => {
  try {
    const { email, productId, comment, rating } = req.body;
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
      return res
        .status(400)
        .json({ message: "productId and email are required" });
    }

    // Find feedback by productId and email
    const feedback = await Feedback.findOne({ productId, email });

    // Check if feedback was found
    if (!feedback) {
      return res
        .status(404)
        .json({ message: "No feedback found for this product and email" });
    }

    res.status(200).json({
      message: "Feedback retrieved successfully",
      data: feedback,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching feedback", error: error.message });
  }
});

// Place Order
app.post("/place-order", async (req, res) => {
  try {
    const { email } = req.query;
    const cart = await Cart.findOne({ email }).populate("products");
    const products = cart.products;

    if (!products.length) {
      return res
        .status(400)
        .json({ message: "No items in cart to place order" });
    }
    //create order per product in cart
    products.forEach(async (product) => {
      await Order.create({
        email,
        product: product._id,
        totalAmount: parseFloat(product.price.replace("$", "")),
      });
    });
    await Cart.deleteMany({ email });

    res.status(201).json({ message: "Order placed successfully" });
  } catch (error) {
    console.error("Error placing order", error.message);
    res
      .status(500)
      .json({ message: "Error placing order", error: error.message });
  }
});

// Get Orders by User
app.get("/orders", async (req, res) => {
  try {
    const { email } = req.query;
    const orders = await Order.find({ email }).populate("product");

    function convertObjectIdToOrder(objectId) {
      // Convert ObjectId to a string and extract the first 8 characters
      const idString = objectId.toString().substring(0, 8);
    
      // Convert the hexadecimal string to a decimal number
      const orderNumber = parseInt(idString, 16);
    
      return `Order ${orderNumber}`;
    }

    orders.forEach((order) => {
      order._id = convertObjectIdToOrder(order._id);
    });

    console.log(orders)
    

    res
      .status(200)
      .json({ message: "Orders retrieved successfully", data: orders });
  } catch (error) {
    console.error("Error fetching orders", error.message);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

app.post("/request-cancel-order", async (req, res) => {
  try {
    const { orderId } = req.query;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    order.status = "Request Cancel";

    await order.save();

    res.status(200).json({ message: "Order cancellation requested" });
  } catch (error) {
    console.error("Error cancelling order", error.message);
    res.status(500).json({ message: "Error cancelling order" });
  }
});
