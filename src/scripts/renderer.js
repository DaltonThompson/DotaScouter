let mayNeedReset = true;
let lastResetTime;
if (localStorage.getItem("lastResetTime") == "undefined")
  localStorage.setItem("lastResetTime", "0");
if (localStorage.getItem("matchUpsLogTime") == "undefined")
  localStorage.setItem("matchUpsLogTime", "0");
localStorage.getItem("lastResetTime")
  ? (lastResetTime = localStorage.getItem("lastResetTime"))
  : (lastResetTime = localStorage.setItem("lastResetTime", Date.now()));
let expiration = 3600000 * 2; // Integer in ms. 3600000 ms === 1 hr

let daysPast = 90;

let weightActivity = 1; // Activity currently refers to a directly calculated percent of all matches in which the hero is played.
let weightWinrate = 1; // 0% is an unplayed hero, 100% is a most played hero.
let weightAdvantage = 5;
let multiplierForOrdering = 1000; // -1000 turns 0.536 into -536, useful for percents where the first decimal matters, and must be negative to display in descending order.

// DOM references
const optionsContainer = document.querySelector(".options_grid");
const banBox = document.getElementById("banbox");
const pickBoxes = document.querySelectorAll(".pick");
let draggingElement;
let dataHeroId;
banBox.addEventListener("dragover", (e) => e.preventDefault());
banBox.addEventListener("drop", () => {
  document
    .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
    .forEach((elem) => elem.classList.add("banned"));
  applyAdvantages();
  orderCards();
});
banBox.addEventListener("click", (e) => {
  if (e.target.classList.contains("banned")) {
    dataHeroId = e.target.getAttribute("data-heroId");
    document
      .querySelectorAll(`.hero${dataHeroId}`)
      .forEach((elem) => elem.classList.remove("banned"));
    applyAdvantages();
    orderCards();
  }
});

optionsContainer.addEventListener("dragover", (e) => {
  if (
    e.target.parentElement.classList.contains("player_border") ||
    e.target.classList.contains("pick")
  ) {
    e.preventDefault();
  }
});
optionsContainer.addEventListener("drop", (e) => {
  if (
    e.target.parentElement.classList.contains("player_border") ||
    e.target.classList.contains("pick")
  ) {
    const targetPickBox = e.target.parentElement.querySelector(".pick");
    dataDropId = targetPickBox.getAttribute("data-heroId");
    targetPickBox.classList.remove(`hero${dataDropId}`);
    targetPickBox.removeAttribute("data-heroId", dataDropId);
    document
      .querySelectorAll(`[data-heroId="${dataDropId}"]`)
      .forEach((elem) => elem.classList.remove("picked"));
    let dataHeroId = document
      .querySelector(".dragging")
      .getAttribute("data-heroId");
    document
      .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
      .forEach((elem) => elem.classList.add("picked"));
    targetPickBox.classList.add(`hero${dataHeroId}`);
    targetPickBox.setAttribute("data-heroId", dataHeroId);

    targetPickBox.addEventListener("click", () => {
      dataDropId = targetPickBox.getAttribute("data-heroId");
      targetPickBox.classList.remove(`hero${dataDropId}`);
      targetPickBox.removeAttribute("data-heroId", dataDropId);
      document
        .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
        .forEach((elem) => elem.classList.remove("picked"));
      applyAdvantages();
      orderCards();
    });
    applyAdvantages();
    orderCards();
  }
});

// Declares number of players to evaluate. Only change if testing.
let playersTotalInGame = 10;
let targetPath; // = server_log;

let steamIds;
let currentMatch;

document
  .getElementById("buttonEnterIds")
  .addEventListener("click", seeInputBoxes);
document
  .getElementById("cancelSubmission")
  .addEventListener("click", hideInputBoxes);
let formIds = document.getElementById("idSubmission");
let buttonEnterIds = document.getElementById("buttonEnterIds");

function seeInputBoxes() {
  formIds.style = "display: contents;";
  buttonEnterIds.style = "display: none;";
}
function hideInputBoxes() {
  formIds.style = "display: none;";
  buttonEnterIds.style = "display: inline-block;";
}

let validPlayers = [];
function determineValidPlayers() {
  let arr = [];
  for (let i = 0; i < steamIds.length; i++) {
    if (steamIds[i] > 0) arr.push(i);
  }

  return (validPlayers = arr);
}

const fetchThings = async (targetUri, targetItem, backupUri) => {
  const response = await fetch(targetUri);
  if (response.status === 200)
    return (localStorage[targetItem] = await response.text());
  await playerHeroFetch(targetItem, backupUri);
};

const playerHeroFetch = async (targetItem, backupUri) => {
  const response = await fetch(backupUri);
  if (response.status === 200) {
    let obj = await response.text();
    obj = obj.replace(/"hero_id"/g, `"heroId"`);
    obj = obj.replace(/"games"/g, `"matchCount"`);
    obj = obj.replace(/"last_played"/g, `"lastPlayed"`);
    obj = obj.replace(/"win"/g, `"winCount"`);
    return (localStorage[targetItem] = obj);
  }
};

const fetchAndSave = async (targetItem, targetUri, backupUri) => {
  try {
    if (!mayNeedReset && localStorage[targetItem])
      return localStorage[targetItem];
  } catch (error) {
    // if (error === 403 ) try OpenDota API instead, if still 403, say "hidden" in UI for player.
    console.log(error.response);
  }
  await fetchThings(targetUri, targetItem, backupUri);
};

const getGlobalStats = async () => {
  // Get heroStats and determine which steamIds are valid simultaneously
  await fetchAndSave(`heroStats`, `https://api.opendota.com/api/heroStats`);
  heroStats = JSON.parse(localStorage.heroStats);
};

const promiseChain = async () => {
  // Get heroStats, and determine which steamIds are valid simultaneously
  await determineValidPlayers();
  // Simultaneously get heroPerformance for each player and create hero cards.
  await Promise.all([
    iterateThroughPlayers((i) =>
      playerHeroFetch(
        `player${steamIds[i]}days${daysPast}`,
        `https://api.opendota.com/api/players/${steamIds[i]}/heroes?date=${daysPast}`
      )
    ),
    initializeHeroCards(),
  ]);
  await applyAdvantages();
  orderCards();

  // Simultaneously get personal data (e.g. username) and create player cards.
  await iterateThroughPlayers((i) =>
    fetchAndSave(
      `player${steamIds[i]}`,
      `https://api.opendota.com/api/players/${steamIds[i]}`
    )
  ),
    iterateThroughPlayers(createPlayerCards);
};

const iterateThroughPlayers = async (callback) => {
  let promiseArray = [];
  for (let i = 0; i < validPlayers.length; i++)
    promiseArray.push(callback(validPlayers[i]));
  return Promise.all(promiseArray);
};

function initializeHeroCards() {
  for (let i = 0; i < heroStats.length; i++) {
    for (let j = 0; j < 10; j++) {
      // Set up element to insert.
      let heroCard = document.createElement("div");
      heroCard.className = `heroCard player${j}`;
      optionsContainer.appendChild(heroCard);
      heroCard.classList.add(`hero${heroStats[i].id}`, `draggable`);
      heroCard.setAttribute("id", `player${j}__hero${heroStats[i].id}`);
      heroCard.setAttribute("data-heroId", `${heroStats[i].id}`);
      heroCard.setAttribute("draggable", true);

      let heroCardPrimaryContainer = document.createElement("div");
      let heroIcon = document.createElement("div");
      let heroScore = document.createElement("span");
      heroCardPrimaryContainer.classList.add(`container`);
      heroIcon.classList.add(`heroIcon`, `hero${heroStats[i].id}`, `draggable`);
      heroScore.className = `heroScore hero${heroStats[i].id} cardData`;
      heroIcon.setAttribute("draggable", true);
      heroIcon.setAttribute("data-heroId", `${heroStats[i].id}`);
      heroCardPrimaryContainer.appendChild(heroIcon);
      heroCardPrimaryContainer.appendChild(heroScore);
      heroCard.appendChild(heroCardPrimaryContainer);

      let collapsingCard = document.createElement("div");
      collapsingCard.className = `collapsingCard`;

      let matchCountContainer = document.createElement("div");
      let elemTitleMatchCount = document.createElement("span");
      let elemMatchCount = document.createElement("span");
      matchCountContainer.className = `container container__matchCount`;
      elemTitleMatchCount.className = `cardTitle cardTitle__matchCount`;
      elemTitleMatchCount.innerText = "Matches";
      elemMatchCount.className = `matchCount cardData`;
      matchCountContainer.appendChild(elemTitleMatchCount);
      matchCountContainer.appendChild(elemMatchCount);

      let winRateContainer = document.createElement("div");
      let elemTitleWinRate = document.createElement("span");
      let elemWinRate = document.createElement("span");
      winRateContainer.className = `container container__winRate`;
      elemTitleWinRate.className = `cardTitle cardTitle__winRate`;
      elemTitleWinRate.innerText = "Win";
      elemWinRate.className = `winRate cardData`;
      winRateContainer.appendChild(elemTitleWinRate);
      winRateContainer.appendChild(elemWinRate);

      let advantageContainer = document.createElement("div");
      let elemAdvScore = document.createElement("span");
      let elemTitleAdv = document.createElement("span");
      advantageContainer.className = `container container__advantage`;
      elemTitleAdv.className = `cardTitle cardTitle__advantage`;
      elemTitleAdv.innerText = "Advantage";
      elemAdvScore.className = `advantage cardData`;
      advantageContainer.appendChild(elemTitleAdv);
      advantageContainer.appendChild(elemAdvScore);

      collapsingCard.appendChild(matchCountContainer);
      collapsingCard.appendChild(winRateContainer);
      collapsingCard.appendChild(advantageContainer);
      heroCard.appendChild(collapsingCard);
    }
    let banIcon = document.createElement("div");
    banIcon.className = `icon heroIcon hero${heroStats[i].id}`;
    banBox.appendChild(banIcon);
    banIcon.setAttribute("data-heroId", `${heroStats[i].id}`);

    // banIcon.setAttribute("draggable", true);
  }
  draggables = document.querySelectorAll(`.draggable`);

  optionsContainer.addEventListener("dragstart", (e) => {
    const dragAndGlow = (targetElem) => {
      targetElem.classList.add("dragging");
      banBox.classList.add("glow");
      pickBoxes.forEach((pickBox) => pickBox.classList.add("glow"));
      draggingElement = document.querySelector(".dragging");
      dataHeroId = targetElem.getAttribute("data-heroId");
      document
        .querySelectorAll(`.hero${dataHeroId}`)
        .forEach((elem) => elem.classList.remove("banned"));
    };
    if (e.target.classList.contains("heroCard")) {
      dragAndGlow(e.target);
    }
  });
  optionsContainer.addEventListener("dragend", (e) => {
    if (e.target.classList.contains("heroCard")) {
      e.target.classList.remove("dragging");
      banBox.classList.remove("glow");
      pickBoxes.forEach((pickBox) => pickBox.classList.remove("glow"));
    }
  });
  optionsContainer.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("heroCard") &&
      !e.target.classList.contains("expanded")
    ) {
      e.target.classList.add("expanded");
    } else if (
      e.target.classList.contains("heroCard") &&
      e.target.classList.contains("expanded")
    ) {
      e.target.classList.remove("expanded");
    }
  });
}

function orderCards() {
  validPlayers.forEach((i) => {
    applyOrderToHeroCard(i, steamIds[i]);
  });
}

async function applyOrderToHeroCard(i, id) {
  let performanceRef;
  try {
    performanceRef = await JSON.parse(
      localStorage.getItem(`player${id}days${daysPast}`)
    );
  } catch (error) {
    // return (document.getElementById(`player${i}__noHeroData`).style.display =
    //   "flex");
  }
  if (performanceRef.length === 0) {
    // document
    //   .querySelectorAll(`.heroCard.player${i}`)
    //   .forEach((elem) => (elem.style = null));
    return (document.getElementById(`player${i}__noHeroData`).style.display =
      "flex");
  }
  let { totalMatchCount, totalHeroesPlayed, mostPlayedPerHero } =
    findTotalMatches(performanceRef);

  iterateThroughHeroes((heroId) => {
    //if we can find the hero in the player's history
    let heroMatchCount = 0;
    let winCount = 0;
    let heroObject = performanceRef.find(
      (playerAsHero) => playerAsHero.heroId == heroId
    );
    if (heroObject) {
      let matchesAndImp = heroIMPAndMatchCount(heroObject);
      heroMatchCount = matchesAndImp.heroMatchCount;
      winCount = matchesAndImp.winCount;
    } else {
    }
    let heroAdvScore = 0;
    let foundAdv = advCalculated.find((elem) => elem.heroId == heroId);
    if (foundAdv) {
      i < 5
        ? (heroAdvScore = foundAdv.radiantAdv)
        : (heroAdvScore = foundAdv.direAdv);
    }
    if (heroMatchCount > 0) {
      document.querySelector(`#player${i}__hero${heroId} .winRate`).innerText =
        Math.round((100 * winCount) / heroMatchCount) - 50;
      document.querySelector(
        `#player${i}__hero${heroId} .matchCount`
      ).innerText = heroMatchCount;
    } else {
      heroMatchCount = 1;
    }
    if (mostPlayedPerHero == 0) mostPlayedPerHero = 1;
    let orderOfCards = Math.round(
      (multiplierForOrdering *
        (weightWinrate * (winCount / heroMatchCount) +
          weightActivity * (heroMatchCount / mostPlayedPerHero) +
          weightAdvantage * heroAdvScore)) /
        (weightActivity + weightWinrate + weightAdvantage)
    );
    document.getElementById(`player${i}__hero${heroId}`).style.order =
      -orderOfCards;
    document.querySelector(`#player${i}__hero${heroId} .heroScore`).innerText =
      Math.round(
        (orderOfCards * 100) / multiplierForOrdering - 50 //Divide by multiplierForOrdering to return to 0-1 scale, multiply by 100 to get percents, and subtract 50 to set 50% to 0.
      );
  });
}

function findTotalMatches(playerPerformanceObj) {
  let totalMatchCount = 0;
  let totalHeroesPlayed = 0;
  let mostPlayedPerHero = 0;
  playerPerformanceObj.forEach((playerAsHero) => {
    totalMatchCount += playerAsHero.matchCount;
    if (playerAsHero.matchCount > 0) totalHeroesPlayed++;
    if (mostPlayedPerHero < playerAsHero.matchCount) {
      mostPlayedPerHero = playerAsHero.matchCount;
    }
  });
  return { totalMatchCount, totalHeroesPlayed, mostPlayedPerHero };
}

// Takes each line of heroPerformance, pulls the player's hero IMP score, converts into 0-to-1 scale (compatible with percentages), and returns it.
function heroIMPAndMatchCount(playerAsHero) {
  return {
    heroMatchCount: playerAsHero.matchCount,
    winCount: playerAsHero.winCount,
  };
}

const createPlayerCards = (i) => {
  let playerRef;
  try {
    if (localStorage[`player${steamIds[i]}`] == "")
      throw "API has no player data.";
    playerRef = JSON.parse(localStorage[`player${steamIds[i]}`]);
    document.querySelector(`.player${i} .player_name`).innerText =
      playerRef?.profile?.personaname;
    let playeri = document.querySelector(`.player${i} .player_rank`);
    if (playerRef?.rank_tier) {
      let tier = playerRef?.rank_tier.toString();
      let medal = tier.charAt(0),
        star = tier.charAt(1);

      switch (medal) {
        case "1":
          playeri.innerText = `Herald ${star}`;
          break;

        case "2":
          playeri.innerText = `Guardian ${star}`;
          break;

        case "3":
          playeri.innerText = `Crusader ${star}`;
          break;

        case "4":
          playeri.innerText = `Archon ${star}`;
          break;

        case "5":
          playeri.innerText = `Legend ${star}`;
          break;

        case "6":
          playeri.innerText = `Ancient ${star}`;
          break;

        case "7":
          playeri.innerText = `Divine ${star}`;
          i;
          break;

        case "8":
          playeri.innerText = `Immortal${
            playerRef?.leaderboard_rank
              ? " #" + playerRef?.leaderboard_rank
              : ""
          }`;
          break;

        default:
          playeri.innerText = `N/A`;
      }
    } else {
      playeri.innerText = `N/A`;
    }
  } catch {
    console.error(`Could not get player${i} name`);
    return (document.getElementById(`player${i}__noPlayerData`).style.display =
      "block");
  }
};

function useUrlQuery() {
  let url = new URL(window.location.href);
  let paramId = url.searchParams.getAll("id");
  let paramPos = url.searchParams.getAll("pos");
  if (url.searchParams.get("days")) daysPast = url.searchParams.get("days");
  steamIds = paramId;
  for (let i = 0; i < steamIds.length; i++) {
    document.getElementById(`playerId${i}`).value = steamIds[i];
  }
  for (let i = 0; i < paramPos.length; i++) {
    let roleToInsert;
    switch (paramPos[i]) {
      default:
        roleToInsert = "N/A";
        break;
      case "1":
        roleToInsert = "Carry";
        break;
      case "2":
        roleToInsert = "Mid";
        break;
      case "3":
        roleToInsert = "Offlane";
        break;
      case "4":
        roleToInsert = "Soft Support";
        break;
      case "5":
        roleToInsert = "Hard Support";
        break;
    }
    document.getElementById(`player${i}__player_role`).innerText = roleToInsert;
  }
  document.getElementById(`days`).value = daysPast;
  promiseChain();
}

let matchUps;
async function startProgram() {
  let matchUpsLogTime;
  let advFile = await fetch("./src/matchups.json");
  matchUps = await advFile.json();
  if (localStorage.getItem(`matchUps`)) {
    matchUps = JSON.parse(localStorage.getItem(`matchUps`));
    matchUpsLogTime = JSON.parse(localStorage.getItem(`matchUpsLogTime`));
  }
  if (lastResetTime < Date.now() - expiration) {
    localStorage.clear();
    localStorage.setItem("lastResetTime", Date.now());
    localStorage.setItem(`matchUps`, JSON.stringify(matchUps));
    localStorage.setItem(`matchUpsLogTime`, matchUpsLogTime);
  }
  mayNeedReset = false;
  await getGlobalStats();
  useUrlQuery();
}

startProgram();

let matchUpArray = [];
const iterateThroughHeroes = async (callback) => {
  let promiseArray = [];
  for (let i = 0; i < heroStats.length; i++)
    promiseArray.push(callback(heroStats[i].id));
  return Promise.all(promiseArray);
};

const getAllMatchups = () =>
  iterateThroughHeroes((id) => getMatchups(id, heroStats.length - 1));

function findBestSynergyCounter(heroId, allyArray, enemyArray, bans) {
  let matchUpsOfHero = matchUps.find((element) => element.heroId == heroId);
  if (!matchUpsOfHero) {
    console.log(
      "A hero could not be found. This may happen if a new hero been recently introduced to the game."
    );
    return;
  }
  for (let i = 0; i < matchUpsOfHero.vs.length; i++) {
    if (bans?.includes(matchUpsOfHero.vs[i].heroId2))
      matchUpsOfHero.vs.splice(i, 1);
  }
  for (let i = 0; i < matchUpsOfHero.with.length; i++) {
    if (bans?.includes(matchUpsOfHero.with[i].heroId2))
      matchUpsOfHero.with.splice(i, 1);
  }

  let strongestCounters = matchUpsOfHero.vs.slice(
    matchUpsOfHero.vs.length + enemyArray?.length - 5,
    matchUpsOfHero.vs.length
  );
  enemyArray?.forEach((heroId2) => {
    strongestCounters.push(
      matchUpsOfHero.vs.find((element) => element.heroId2 == heroId2)
    );
  });

  let strongestCountersScore = 0;
  strongestCounters.forEach((elem) => {
    if (elem?.winRate) strongestCountersScore += elem.winRate;
  });
  strongestCountersScore = strongestCountersScore / strongestCounters.length;

  let strongestTeam = matchUpsOfHero.with.slice(0, 4 - allyArray?.length);
  allyArray?.forEach((heroId2) => {
    strongestTeam.push(
      matchUpsOfHero.with.find((element) => element.heroId2 == heroId2)
    );
  });

  let strongestTeamScore = 0;
  strongestTeam.forEach((elem) => {
    if (elem?.winRate) strongestTeamScore += elem.winRate;
  });
  strongestTeamScore = strongestTeamScore / strongestTeam.length;

  let totalPickScore = (strongestCountersScore + strongestTeamScore) / 2;

  return {
    strongestCounters,
    strongestCountersScore,
    strongestTeam,
    strongestTeamScore,
    totalPickScore,
  };
}

const getPickBanArrays = () => {
  let pickArray = document.querySelectorAll(`.pick`);
  let radiantArray = [];
  let direArray = [];
  let allPicks = [];
  for (let i = 0; i < pickArray.length; i++) {
    let pickId = pickArray[i].getAttribute(`data-heroId`);
    allPicks.push(pickId);
    if (pickId && i < 5) {
      radiantArray.push(pickId);
    }
    if (pickId && i >= 5) direArray.push(pickId);
  }

  let banArray = document.querySelectorAll(`#banbox .banned`);
  let bans = [];
  for (let i = 0; i < banArray.length; i++) {
    let banId = banArray[i].getAttribute(`data-heroId`);
    if (banId) bans.push(banId);
  }
  return { allPicks, radiantArray, direArray, bans };
};

let advCalculated;
async function applyAdvantages() {
  advCalculated = [];
  let { allPicks, radiantArray, direArray, bans } = getPickBanArrays();
  iterateThroughHeroes((heroId) => {
    let obj = {};
    obj.heroId = heroId;
    let radiantAdv,
      direAdv,
      radiantAdvToDisplay = "",
      direAdvToDisplay = "";
    if (!allPicks.includes(heroId) && !bans.includes(heroId)) {
      try {
        radiantAdv = findBestSynergyCounter(
          heroId,
          radiantArray,
          direArray,
          bans
        ).totalPickScore;
        obj.radiantAdv = radiantAdv;
        direAdv = findBestSynergyCounter(
          heroId,
          direArray,
          radiantArray,
          bans
        ).totalPickScore;
        obj.direAdv = direAdv;
        advCalculated.push(obj);
        radiantAdvToDisplay = Math.round(radiantAdv * 100) - 50;
        direAdvToDisplay = Math.round(direAdv * 100) - 50;
      } catch (error) {
        console.log(error);
      }
      for (let radiantPlayer = 0; radiantPlayer < 5; radiantPlayer++) {
        document.querySelector(
          `#player${radiantPlayer}__hero${heroId} > div.collapsingCard > div.container.container__advantage > span.advantage.cardData`
        ).innerText = radiantAdvToDisplay;
      }
      for (let direPlayer = 5; direPlayer < 10; direPlayer++) {
        document.querySelector(
          `#player${direPlayer}__hero${heroId} > div.collapsingCard > div.container.container__advantage > span.advantage.cardData`
        ).innerText = direAdvToDisplay;
      }
    }
  });
}
