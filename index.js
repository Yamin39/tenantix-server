const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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

    // get coupons
    app.get("/coupons", async (req, res) => {
      const result = await couponsCollection.find().toArray();
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
    app.get("/agreements", async (req, res) => {
      const email = req.query?.email;

      if (email) {
        const isRequested = await agreementsCollection.findOne({ user_email: email });
        return res.send({ isRequested: !!isRequested });
      }

      const result = await agreementsCollection.find().toArray();
      res.send(result);
    });

    // save agreements
    app.post("/agreements", async (req, res) => {
      const result = await agreementsCollection.insertOne(req.body);
      res.send(result);
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
