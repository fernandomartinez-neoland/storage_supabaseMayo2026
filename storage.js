import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);
// Admin client using the Service Role key (required to create buckets)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BUCKET_NAME = "avatars";
const LOCAL_FILE_PATH = "./img.jpg";
const STORAGE_FILE_PATH = "img.jpg";

async function ensureBucket(name) {
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(name);
  console.log("ensureBucket - getBucket result:", { bucket, bucketError });
  const is404 = bucketError && (bucketError.status === 404 || bucketError.statusCode === 404 || bucketError.statusCode === "404");
  if (bucketError && !is404) {
    throw bucketError;
  }
  if (!bucket) {
    console.log("Bucket no existe. Intentando crear:", name);
    const { data, error } = await supabaseAdmin.storage.createBucket(name, {
      public: true,
    });
    console.log("ensureBucket - createBucket result:", { data, error });
    if (error) {
      throw error;
    }
    return data;
  }
  return bucket;
}

async function uploadFile() {
  try {
    await ensureBucket(BUCKET_NAME);

    const fileContents = fs.readFileSync(LOCAL_FILE_PATH);
    // Intentar subir con reintentos en caso de 404 (propagación del bucket)
    let attempts = 0;
    let result;
    while (attempts < 3) {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(STORAGE_FILE_PATH, fileContents, { upsert: true });

      if (!error) {
        result = { data };
        break;
      }

      // Si es 404, esperar y reintentar
      if (error.status === 404 || error.statusCode === "404") {
        attempts += 1;
        console.warn(`Upload attempt ${attempts} failed with 404, reintentando...`);
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      // Otro error, abortar
      console.error("Error subiendo archivo:", error);
      return;
    }

    if (result && result.data) {
      console.log("Archivo subido con éxito:", result.data);
    } else {
      console.error("No se pudo subir el archivo después de varios intentos.");
    }
  } catch (error) {
    console.error("Error en la conexión o subida:", error);
  }
}

uploadFile();
