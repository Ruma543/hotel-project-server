const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
// token verify
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('value of token', token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: 'unauthorized' });
    }
    console.log('value of token', decoded);
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hybcmzi.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const ServiceCollection = client.db('hotelDB').collection('services');
    const reviewCollection = client.db('hotelDB').collection('reviews');
    const bookingCollection = client.db('hotelDB').collection('bookings');
    const userReviewCollection = client.db('hotelDB').collection('userReview');
    // jwt related api
    // for login
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1hr',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ secure: true });
    });
    // for logout
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logout', user);
      res.clearCookie('token', { maxAge: 0 }).send({ secure: true });
    });
    // post room data
    app.post('/services', async (req, res) => {
      const rooms = req.body;
      const result = await ServiceCollection.insertOne(rooms);
      res.send(result);
    });
    // get room data
    app.get('/services', async (req, res) => {
      let sortObj = {};

      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const skip = (page - 1) * limit;

      if (sortField && sortOrder) {
        sortObj[sortField] = sortOrder;
      }
      const cursor = ServiceCollection.find()
        .skip(skip)
        .limit(limit)
        .sort(sortObj);
      const result = await cursor.toArray();
      const total = await ServiceCollection.countDocuments();
      res.send({ total, result });
    });
    // get one data for details page
    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ServiceCollection.findOne(query);
      res.send(result);
    });

    // for some portion data update
    app.patch('/services/s/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      console.log(data);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          available_rooms: data.available_rooms,
          email: data.email,
          date: data.date,
          customerName: data.customerName,
          roomId: data.roomId,
        },
      };
      const options = { upsert: true };
      const result = await ServiceCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // get one data for update
    app.get('/services/s/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ServiceCollection.findOne(query);
      res.send(result);
    });
    // booking post related data
    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
    // get booking data of user specific
    app.get('/bookings', verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log(req.user);
      console.log('token owner', req.cookies.token);
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ Message: 'forbidden access' });
      }
      let query = {};
      if (req?.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });
    // get one bookings data
    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });
    // Delete data api
    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });
    // reviews related api
    app.get('/reviews', async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // post userReview
    app.post('/userReview', async (req, res) => {
      const userReview = req.body;
      const result = await userReviewCollection.insertOne(userReview);
      res.send(result);
    });
    // get userReview for details page
    app.get('/userReview', async (req, res) => {
      const cursor = userReviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // update date in booking page
    app.patch('/bookings/s/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      console.log(data);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          date: data.date,
        },
      };
      const options = { upsert: true };
      const result = await bookingCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // update review and rating in
    // app.patch('/services/s/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const data = req.body;
    //   console.log(data);
    //   const filter = { roomId: id };
    //   const updateDoc = {
    //     $set: {
    //       review: data.review,
    //       rating: data.rating,
    //     },
    //   };
    //   const options = { upsert: true };
    //   const result = await ServiceCollection.updateOne(
    //     filter,
    //     updateDoc,
    //     options
    //   );
    //   res.send(result);
    // });
    // get one data for update
    // app.get('/services/s/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const query = { roomId: id };
    //   const result = await ServiceCollection.findOne(query);
    //   res.send(result);
    // });

    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('hotel server is running');
});
app.listen(port, () => {
  console.log(`hotel server is running:${port}`);
});
