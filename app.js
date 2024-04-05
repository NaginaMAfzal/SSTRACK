/* eslint-disable func-names */
import express from 'express';
import cors from 'cors';
import status from 'http-status';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import passport from 'passport';
import dbConnection from './Connection/dbConnect.js';
// import Router from './Routes/Router.js';
// import errorHandler from './Middlewares/errorHandler.js';
// import verifyToken from './Middlewares/verifyToken.js';

dbConnection();

const app = express();

// initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(
	express.urlencoded({
		extended: false,
	}),
);

// will decode token from each request in {req.user}
// app.use(verifyToken.verifyToken);

app.use(express.json());

app.get('/', (req, res) => {
	res.status(200).json({ Message: 'Connected'});
});
app.get('/api/users', (req, res) => {
	res.status(200).json({ Message: 'these are users'});
});

// app.use('/signup', Router.SignupRouter);

// app.use('/signin', Router.SigninRouter);

// app.use('/event', Router.EventRouter);

// i have implemented it in signup controller like this {next(new Error('Image is required'))}
// app.use(errorHandler);

const port = process.env.PORT || 5000;

app.listen(port, () =>
	console.log(`App listening On port http://localhost:${port}`),
);
