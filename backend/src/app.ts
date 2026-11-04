import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import routes from './routes';
import errorHandler from './middleware/errorHandler';
import notFound from './middleware/notFound';
import requestLogger from './middleware/requestLogger';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
    cors({
        origin: env.nodeEnv === 'development' ? true : false,
    }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(routes);
app.use(notFound);
app.use(errorHandler);

export default app;