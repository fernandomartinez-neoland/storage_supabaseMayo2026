import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const api = express();
api.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const port = 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function ensureBucket(name) {
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(name);
  const is404 = bucketError && (bucketError.status === 404 || bucketError.statusCode === 404 || bucketError.statusCode === '404');
  if (bucketError && !is404) {
    throw bucketError;
  }

  if (!bucket) {
    const { data, error } = await supabaseAdmin.storage.createBucket(name, {
      public: true,
    });
    if (error) {
      throw error;
    }
    return data;
  }

  return bucket;
}

api.get('/', (req, res) => {
  res.send('holi');
});

api.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const bucket = req.body.bucket || 'avatars';
  const storagePath = req.body.path || file?.originalname?.replace(/\s+/g, '_');

  if (!file) {
    return res.status(400).json({ error: 'No se envió ningún archivo. Usa el campo "file" en multipart/form-data.' });
  }

  if (!storagePath) {
    return res.status(400).json({ error: 'No se pudo determinar el nombre de archivo para almacenar.' });
  }

  try {
    await ensureBucket(bucket);

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, file.buffer, { upsert: true });

    if (error) {
      return res.status(500).json({ error });
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return res.status(200).json({
      uploaded: true,
      bucket,
      path: data.path,
      publicUrl: publicData.publicUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Error en la subida' });
  }
});

api.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

