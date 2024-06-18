const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
const verifyToken = (req, res, next) => {
  console.log("in verify token", req.headers?.authorization);

  if (!req.headers?.authorization) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = req.headers?.authorization?.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.decoded = decoded;
    next();
  });
};

// const uri = 'mongodb://localhost:27017'

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6fu63x8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const roomsCollection = client.db("tenantixDB").collection("rooms");
    const couponsCollection = client.db("tenantixDB").collection("coupons");
    const usersCollection = client.db("tenantixDB").collection("users");
    const agreementsCollection = client.db("tenantixDB").collection("agreements");

    // custom middleware to verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const user = await usersCollection.findOne({ email });

      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden" });
      }

      next();
    };

    // auth apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10d",
      });
      res.send({ token });
    });

    // get rooms
    app.get("/rooms", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await roomsCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // get rooms count
    app.get("/roomsCount", async (req, res) => {
      const count = await roomsCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // update availability of a room
    app.patch("/rooms/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updatedDoc = {
        $set: {
          availability: req.body.availability,
        },
      };
      const result = await roomsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // get coupons
    app.get("/coupons", async (req, res) => {
      const result = await couponsCollection.find().toArray();
      res.send(result);
    });

    // get user
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        res.status(403).send({ message: "Forbidden" });
      }

      const query = { email };
      const result = await usersCollection.findOne(query);

      res.send(result);
    });

    // save users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const isExist = await usersCollection.findOne({ email: user.email });
      if (isExist) {
        res.send({ message: "User already exist", insertedId: null });
        return;
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get agreements
    app.get("/agreements", verifyToken, async (req, res) => {
      const email = req.query?.email;

      // get specific agreement
      if (email) {
        const result = await agreementsCollection.findOne({ user_email: email });
        return res.send(result);
      }

      const result = await agreementsCollection.find().toArray();
      res.send(result);
    });

    // get specific agreement by status
    app.get("/agreements/:email/:status", async (req, res) => {
      const query = {
        user_email: req.params?.email,
        status: req.params?.status,
      };
      const result = await agreementsCollection.findOne(query);
      res.send(result ? result : {});
    });

    // save agreements
    app.post("/agreements", async (req, res) => {
      const result = await agreementsCollection.insertOne(req.body);
      res.send(result);
    });

    // get admin stats
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const total_rooms = await roomsCollection.estimatedDocumentCount();
      const total_users = await usersCollection.countDocuments({ role: "user" });
      const total_members = await usersCollection.countDocuments({ role: "member" });

      const available_rooms = await roomsCollection.countDocuments({ availability: true });
      const percentageOfAvailable_rooms = ((available_rooms / total_rooms) * 100).toFixed(2);

      const unavailable_rooms = await roomsCollection.countDocuments({ availability: false });
      const percentageOfUnavailable_rooms = ((unavailable_rooms / total_rooms) * 100).toFixed(2);

      res.send({
        total_rooms,
        total_users,
        total_members,
        percentageOfAvailable_rooms: Number(percentageOfAvailable_rooms),
        percentageOfUnavailable_rooms: Number(percentageOfUnavailable_rooms),
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Tenantix server is running");
});

app.listen(port, () => {
  console.log(`Tenantix server is running on port: ${port}`);
});
