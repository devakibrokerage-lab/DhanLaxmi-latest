import { MongoClient } from 'mongodb';

const SOURCE_URI = "mongodb+srv://swasthika:Rs7tHFmT6y1NNuR2@swasthikacluster.bkpfmoi.mongodb.net/?appName=SwasthikaCluster";
const DEST_URI = "mongodb+srv://devakibrokerage_db_user:2hmSRDFDyuT4bLgJ@newswasthikacluster.snofy1c.mongodb.net/?appName=NewSwasthikaCluster";

async function migrate() {
    console.log("🚀 Starting Database Migration...");
    const sourceClient = new MongoClient(SOURCE_URI);
    const destClient = new MongoClient(DEST_URI);

    try {
        await sourceClient.connect();
        await destClient.connect();
        console.log("✅ Connected to both source and destination clusters.");

        // List all databases in source
        const adminDb = sourceClient.db().admin();
        const { databases } = await adminDb.listDatabases();

        for (const dbInfo of databases) {
            const dbName = dbInfo.name;
            // Skip system databases
            if (['admin', 'local', 'config'].includes(dbName)) continue;

            console.log(`\n📂 Processing Database: ${dbName}`);
            const sourceDb = sourceClient.db(dbName);
            const destDb = destClient.db(dbName);

            // Get all collections in the current database
            const collections = await sourceDb.listCollections().toArray();

            for (const collInfo of collections) {
                const collName = collInfo.name;
                if (collName.startsWith('system.')) continue;

                console.log(`  📄 Collection: ${collName}`);

                // 1. Clear destination collection (as requested: "delete kar do sab")
                console.log(`    🧹 Clearing destination collection: ${collName}...`);
                await destDb.collection(collName).deleteMany({});

                // 2. Fetch data from source
                const docs = await sourceDb.collection(collName).find({}).toArray();

                if (docs.length > 0) {
                    console.log(`    📦 Copying ${docs.length} documents...`);
                    // Use insertMany for bulk insertion
                    // Note: If data is extremely large (millions of rows), consider batching or streaming.
                    // For typical app data, insertMany is efficient enough.
                    await destDb.collection(collName).insertMany(docs, { ordered: false });
                    console.log(`    ✅ Copied ${docs.length} documents.`);
                } else {
                    console.log(`    ℹ️  Collection is empty, skipping copy.`);
                }
            }
        }
        console.log("\n🎉 Migration completed successfully!");
    } catch (err) {
        console.error("\n❌ Migration failed:");
        console.error(err);
    } finally {
        await sourceClient.close();
        await destClient.close();
        console.log("🔌 Connections closed.");
    }
}

migrate();
