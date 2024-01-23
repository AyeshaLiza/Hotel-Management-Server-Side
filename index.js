const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const app = express()
require('dotenv').config()

const port = process.env.PORT || 8000

// middleware

app.use(cors(
  {
    origin: ['http://localhost:5173', 'http://localhost:5174' ],
    credentials: true
  }
));
app.use(express.json());
app.use(cookieParser())

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p1divt7.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

  
    const roomCollection = client.db('hotelManagement').collection('room');
    const bookingCollection = client.db('hotelManagement').collection('booking');
    const seatsCollection = client.db('hotelManagement').collection('seats');
    const reviewCollection = client.db('hotelManagement').collection('reviews');

    // get rooms & filtering
    app.get('/api/v1/room', async (req, res) => {
      // situation 1
      let queryObj = {}
      const priceRange = req.query.priceRange;
      if (priceRange) {
        queryObj.priceRange = priceRange
      }
      const cursor = roomCollection.find(queryObj)
      const result = await cursor.toArray();
      res.send(result)
    })
    app.get('/api/v1/seats', async (req, res) =>{
      const cursor = seatsCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/api/v1/room/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: { title: 1, detail: 1, roomImg: 1 },
      }
      const result = await roomCollection.findOne(query, options)
      res.send(result);
    }
    )
    // app.get('/api/v1/reviews/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) }
     
    //   const result = await reviewCollection.findOne(query)
    //   res.send(result);
    // }
    // )

   
  
    app.get('/api/v1/roomBookings', async (req, res) => {
      const queryEmail =   req.query?.email;
      let query = {}
      if (queryEmail) {
        query = { email: queryEmail }
      }
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
      console.log(result);
    })
    // app.get('/api/v1/reviews', async (req, res) => {
    //   const queryEmail =   req.query?.email;
    //   let query = {}
    //   if (queryEmail) {
    //     query = { email: queryEmail }
    //   }
    //   const result = await bookingCollection.find(query).toArray()
    //   res.send(result)
    //   console.log(result);
    // })

        // auth related api
        app.post('/api/v1/auth/access-token', async (req, res) => {
          const userEmail = req.body
          console.log('new twt token', userEmail);
          //  creating token & send to client
          const token = jwt.sign(userEmail , process.env.ACCESS_TOKEN, {expiresIn: '365d'})
          console.log(token);
        
          res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'none'
        })
            .send({ success: true });
    })

    
    app.post('/api/v1/roomBookings', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })
    app.delete('/api/v1/bookings/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })

    // room booking
    app.patch('/api/v1/roomBookings/:id', async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      // console.log(id);
      const findData = { _id: new ObjectId(id) }
      const findAvailable = await roomCollection.findOne(findData)
      if(!findAvailable){
        return res.status(404).send("You Can not  BOok Room");
      } 
      const currentRoom = findAvailable.availableSeat

      if (currentRoom <= 0) {
        return res.status(400).send("No available seats");
    }
    const updatedAvailableSeats = currentRoom - 1;
      const updateDataRoom = {
        $set: {
            availableSeat: updatedAvailableSeats
        }
    };

    const updateDataBooking = {
        $set: {
            ...body,
            currentRoom: updatedAvailableSeats
        }
    };
    const resultRoom = await roomCollection.updateOne(findData, updateDataRoom);

    if (resultRoom.modifiedCount === 0) {
      return res.status(500).send("Failed to update room data");
  }
     const option = {upsert : true}
      // console.log(findAvailable);
      const resultBooking = await bookingCollection.updateOne(findData, updateDataBooking, option);
      res.send(resultBooking);
      // const updateData = {
      //    $set:{
      //       ...body, 
      //       currentRoom: currentRoomAvail
      //    } }
      // const result = await bookingCollection.updateOne(findData, updateData, option)
      // res.send(result)
    })
    app.put('/api/v1/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      console.log(id);
      const filter = { _id: new ObjectId(id) }
      const updateBooking = {
         $set:{
          ...body
         } }
         const option = {upsert : true}
      const result = await bookingCollection.updateOne(filter, updateBooking, option)
      res.send(result)
    })

    app.post('/api/v1/reviews', async (req, res) => {
      const reviews = req.body;
      console.log(reviews);
      reviews.timestamp = new Date()    
     const result = await reviewCollection.insertOne( reviews)
     res.send(result)
    })

   // Logout
   app.get('/logout', async (req, res) => {
    try {
      res
        .clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
      console.log('Logout successful')
    } catch (err) {
      res.status(500).send(err)
    }
  })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hotel Management Website running successfully')
})
app.listen(port, () => {
  console.log(`hotel managemnet running on ${port}`);
})