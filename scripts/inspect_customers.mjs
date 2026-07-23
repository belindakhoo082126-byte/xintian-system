import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await connection.query("SHOW CREATE TABLE customers");
console.log(rows[0]["Create Table"]);
await connection.end();
