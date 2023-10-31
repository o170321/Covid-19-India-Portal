const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jsonwebtoken = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server started on port 3000");
    });
  } catch (error) {
    console.log(`DB error: ${error.message}`);
  }
};

initializeDBAndServer();

// AUTHORIZATION token middleware
function authorization(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

// API 1: User Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jsonwebtoken.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2: Get List of States
app.get("/states/", authorization, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const states = await db.all(getStatesQuery);
  const formattedStates = states.map((state) => formatState(state));
  response.send(formattedStates);
});

// API 3: Get State by ID
app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(formatState(state));
});

// API 4: Add District
app.post("/districts/", authorization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
  `;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// API 5: Get District by ID
app.get("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const district = await db.get(getDistrictQuery);
  response.send(formatDistrict(district));
});

// API 6: Delete District
app.delete("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
  await db.run(deleteDistrictQuery);
  response.send("District Removed");
});

// API 7: Update District
app.put("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
    UPDATE district SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};
  `;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

// API 8: Get State Stats
app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStateStatsQuery = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured,
    SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};
  `;
  const stateStats = await db.get(getStateStatsQuery);
  response.send(stateStats);
});

function formatState(state) {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
}

function formatDistrict(district) {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
}

module.exports = app;
