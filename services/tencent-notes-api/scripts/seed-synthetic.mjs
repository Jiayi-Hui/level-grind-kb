import pg from "pg";
import { encryptText, loadCryptoContext } from "../crypto-envelope.mjs";

if (process.env.ALLOW_SYNTHETIC_FIXTURES !== "true") throw new Error("Set ALLOW_SYNTHETIC_FIXTURES=true to seed synthetic fixtures");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const context = loadCryptoContext();
const userId = "10000000-0000-4000-8000-000000000001";
const noteId = "10000000-0000-4000-8000-000000000101";
const ideaId = "10000000-0000-4000-8000-000000000201";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : undefined });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`INSERT INTO research_users (id,clerk_user_id,email,display_name) VALUES ($1,'user_synthetic_fixture','synthetic.fixture@example.test','Synthetic Fixture') ON CONFLICT (clerk_user_id) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id`, [userId]);
  const owner=(await client.query(`SELECT id FROM research_users WHERE clerk_user_id='user_synthetic_fixture'`)).rows[0].id;
  await client.query(`INSERT INTO research_team_memberships (team_id,user_id,role) VALUES ('level-grind',$1,'Analyst') ON CONFLICT (team_id,user_id) DO UPDATE SET status='active'`,[owner]);

  const note = encryptText("Synthetic fixture only. Not research content.",context,{teamId:"level-grind",recordType:"note",recordId:noteId});
  await client.query(`INSERT INTO research_notes (id,team_id,owner_user_id,title,body_ciphertext_b64,body_nonce_b64,body_auth_tag_b64,body_wrapped_data_key_b64,body_key_wrap_nonce_b64,body_key_wrap_auth_tag_b64,body_key_version,source_kind,sensitivity_level) VALUES ($1,'level-grind',$2,'Synthetic fixture Note',$3,$4,$5,$6,$7,$8,$9,'synthetic_demo','public') ON CONFLICT (id) DO UPDATE SET body_ciphertext_b64=EXCLUDED.body_ciphertext_b64,body_nonce_b64=EXCLUDED.body_nonce_b64,body_auth_tag_b64=EXCLUDED.body_auth_tag_b64,body_wrapped_data_key_b64=EXCLUDED.body_wrapped_data_key_b64,body_key_wrap_nonce_b64=EXCLUDED.body_key_wrap_nonce_b64,body_key_wrap_auth_tag_b64=EXCLUDED.body_key_wrap_auth_tag_b64,body_key_version=EXCLUDED.body_key_version,updated_at=now(),deleted_at=NULL`,[noteId,owner,note.ciphertext_b64,note.nonce_b64,note.auth_tag_b64,note.wrapped_data_key_b64,note.key_wrap_nonce_b64,note.key_wrap_auth_tag_b64,note.key_version]);

  const idea = encryptText("Synthetic fixture thesis. Not an investment recommendation.",context,{teamId:"level-grind",recordType:"idea",recordId:ideaId});
  await client.query(`INSERT INTO research_ideas (id,team_id,owner_user_id,title,ticker,direction,status,thesis_ciphertext_b64,thesis_nonce_b64,thesis_auth_tag_b64,thesis_wrapped_data_key_b64,thesis_key_wrap_nonce_b64,thesis_key_wrap_auth_tag_b64,thesis_key_version) VALUES ($1,'level-grind',$2,'Synthetic fixture Idea','DEMO','watch','pending_review',$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET thesis_ciphertext_b64=EXCLUDED.thesis_ciphertext_b64,thesis_nonce_b64=EXCLUDED.thesis_nonce_b64,thesis_auth_tag_b64=EXCLUDED.thesis_auth_tag_b64,thesis_wrapped_data_key_b64=EXCLUDED.thesis_wrapped_data_key_b64,thesis_key_wrap_nonce_b64=EXCLUDED.thesis_key_wrap_nonce_b64,thesis_key_wrap_auth_tag_b64=EXCLUDED.thesis_key_wrap_auth_tag_b64,thesis_key_version=EXCLUDED.thesis_key_version,updated_at=now(),deleted_at=NULL`,[ideaId,owner,idea.ciphertext_b64,idea.nonce_b64,idea.auth_tag_b64,idea.wrapped_data_key_b64,idea.key_wrap_nonce_b64,idea.key_wrap_auth_tag_b64,idea.key_version]);
  await client.query(`INSERT INTO research_idea_note_links (idea_id,note_id,created_by_user_id) VALUES ($1,$2,$3) ON CONFLICT (idea_id,note_id) DO UPDATE SET deleted_at=NULL,created_by_user_id=EXCLUDED.created_by_user_id`,[ideaId,noteId,owner]);
  await client.query("COMMIT");
  console.log("Synthetic Note, Idea, and link are ready");
} catch(e) { await client.query("ROLLBACK"); throw e; } finally { await client.end(); }
