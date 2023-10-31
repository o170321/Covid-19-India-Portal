const express = require("express");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const path = require("path");

const jsonwebtoken = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

const bcrypt = require("bcrypt");

app.use(express.json());
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("server started in the port 3000");
    });
  } catch (e) {
    console.log(`db error ${e.message}`);
  }
};

initializeDBAndServer();
//AUTHORIZATION token

function authorization(request, response, next) {
  let jwttoekn;
  const AuthHeader = request.headers["authorization"];
  if (AuthHeader !== undefined) {
    jwttoekn = AuthHeader.split(" ")[1];
  }
  if (jwttoekn === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(jwttoekn, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //request.username = payload.username;
        next();
      }
    });
  }
}

//API1
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

//API 2

/*const listmaker = (object) => {
  return {
    statedId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};*/

const listmaker = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};
app.get("/states/", authorization, async (request, response) => {
  const getStatesQuery = `
              SELECT * FROM state;`;
  const result = await db.all(getStatesQuery);
  //response.send(result.map((objectu) => listmaker(objectu)));
  response.send(result.map((objectu) => listmaker(objectu)));
});

const listmaker2 = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};
//API 3
app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;
  const resultQuery = await db.get(getStateQuery);
  response.send(listmaker2(resultQuery));
});

app.post("/districts/", authorization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) 
  values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrict = await db.run(createDistrictQuery);
  response.send(`District Successfully Added`);
});

//            API 5
//Returns a district based on the district ID
const convertDbObjectDistrict = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};
app.get("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictByIdQuery = `select * from district where district_id=${districtId};`;
  const getDistrictByIdQueryResponse = await db.get(getDistrictByIdQuery);
  response.send(convertDbObjectDistrict(getDistrictByIdQueryResponse));
});

//----------------------API 6
//Deletes a district from the district table based on the district ID
// only authenticated users can delete data from database.

app.delete(
  "/districts/:districtId/",
  authorization,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id = ${districtId};`;
    const deleteDistrict = await db.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

//                                API 7
//Updates the details of a specific district based on the district ID
// only authenticated users can update the data.
app.put("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `update district set
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths} where district_id = ${districtId};`;

  const updateDistrictQueryResponse = await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

  const getStateByIDStatsQueryResponse = await db.get(getStateByIDStatsQuery);
  response.send(getStateByIDStatsQueryResponse);
});
module.exports = app;
