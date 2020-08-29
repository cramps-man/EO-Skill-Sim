import Class from './class.js';

const allStyles = getComputedStyle(document.documentElement);

const nodeHeight = parseInt(allStyles.getPropertyValue("--node-height").trim().slice(0, -2));
const verticalPadding = parseInt(allStyles.getPropertyValue("--node-vertical-padding").trim().slice(0, -2));


class Simulator {
  #classes = new Map();

  get levelCaps() {
    return [70, 80, 90, 99];
  }

  get retireBonuses() {
    return [
      [0,   'N/A',  0],
      [1, '30-39',  4],
      [2, '40-49',  5],
      [3, '50-59',  6],
      [4, '60-69',  7],
      [5, '70-98',  8],
      [6,    '99', 10],
    ];
  }

  get secondaryPenalty() {
    return 1;
  }

  constructor ({skills, forward, levels}) {
    if (this.constructor === Simulator) {
      throw new TypeError('Abstract class "Simulator" cannot be instantiated directly.');
    }

    for (const [className, classSkillInfo] of Object.entries(skills)) {
      this.#classes.set(className, new Class(className, classSkillInfo, forward[className], levels[className], this));
    }

    this._elements = {
      level: document.getElementById('level'),
      levelCap: document.getElementById('level-cap'),
      retire: document.getElementById('retire'),
      class: document.getElementById('class-selector-primary'),
      subclass: document.getElementById('class-selector-secondary'),
      pointsUsed: document.getElementById('points-current'),
      pointsTotal: document.getElementById('points-total'),
      classTree: document.getElementById('tree-primary'),
      subclassTree: document.getElementById('tree-secondary'),
    };
    Object.freeze(this._elements);

    this._retireLevel = 0;

    this.setRetireLevels();
    this.setLevelCaps();

    this._elements.level.addEventListener("change", ({target: {value}}) => {
      this.level = value;
    });

    this.setClasses();
    this.setDefault();
  }

  get level() {
    return parseInt(this._level);
  }
  set level(value) {
    this._level = value;
    this._elements.level.value = value;
    this.updateSkillPoints();
  }

  get levelCap() {
    return parseInt(this._levelCap);
  }
  set levelCap(value) {
    this._levelCap = value;
    this._elements.levelCap.value = value;
    this.setLevels();
  }

  get retireLevel() {
    return this.retireBonuses[this._retireLevel][1];
  }
  set retireLevel(value) {
    if (this.retireBonuses.length !== 0) {
      this._retireLevel = +value;
      this._elements.retire.value = value.toString();
    }

    this.updateSkillPoints();
  }

  get class() {
    return this._class;
  }
  set class(value) {
    const old = this.class;
    if (old) old.resetSkillLevels();

    this._class = this.#classes.get(value);
    this._elements.class.value = value;
    this.disableClass(false);
    this.createSkillNodes(true);
    this.updateSkillPoints();
  }

  get subclass() {
    return this._subclass;
  }
  set subclass(value) {
    const old = this.subclass;
    if (old) old.resetSkillLevels();

    this._subclass = value !== null ? this.#classes.get(value) : null;
    this._elements.subclass.value = value !== null ? value : 'None';
    this.disableClass(true);
    this.createSkillNodes(false);
    this.updateSkillPoints();
  }

  setDefault() {
    this.class = this.#classes.keys().next().value;
    this.subclass = null;
    this.levelCap = this.levelCaps[0];
    this.level = 1;
    this.retireLevel = 0;
  }

  setRetireLevels() {
    const retireSelect = this._elements.retire;
    while (retireSelect.lastChild) retireSelect.removeChild(retireSelect.lastChild);

    for (const [id, levels,] of this.retireBonuses) {
      const option = document.createElement('option');
      option.value = id.toString();
      option.textContent = levels;
      retireSelect.appendChild(option);
    }

    retireSelect.addEventListener('change', ({target: {value}}) => {
      this.retireLevel = value;
    });
  }

  setLevelCaps() {
    if (this.levelCaps.length === 1) {
      this._levelCap = this.levelCaps[0];
      return;
    }

    const levelCapSelect = this._elements.levelCap;
    while (levelCapSelect.lastChild) levelCapSelect.removeChild(levelCapSelect.lastChild);

    for (const i of this.levelCaps) {
      const option = document.createElement('option');
      option.value = i.toString();
      option.textContent = i.toString();
      levelCapSelect.appendChild(option);
    }

    levelCapSelect.addEventListener('change', ({target: {value}}) => {
      this.levelCap = value;
    });
  }

  setLevels() {
    const levelSelect = this._elements.level;
    while (levelSelect.lastChild) levelSelect.removeChild(levelSelect.lastChild);

    for (let i = 1; i <= this.levelCap; ++i) {
      const option = document.createElement('option');
      option.value = i.toString();
      option.textContent = i.toString();
      levelSelect.appendChild(option);
    }

    this.level = this.level > this.levelCap ? this.levelCap : this.level;
  }

  setClasses() {
    for (const section of ['class', 'subclass']) {
      const classSelector = this._elements[section];

      while (classSelector.lastChild) classSelector.removeChild(classSelector.lastChild);

      if (section === 'subclass') {
        const option = document.createElement('option');
        option.value = 'None';
        option.textContent = 'None';
        classSelector.appendChild(option);
      }

      for (const cls of this.#classes.values()) {
        const option = document.createElement('option');
        option.value = cls.name;
        option.textContent = cls.name;
        classSelector.appendChild(option);
      }

      classSelector.addEventListener('change', ({target: {value}}) => {
        this[section] = value !== 'None' ? value : null;
      });
    }
  }

  disableClass(primary) {
    const id = `#class-selector-${primary ? 'primary' : 'secondary'}`;

    const option = document.querySelector(`${id} option[disabled]`);
    if (option) option.disabled = false;

    const cls = primary ? this.subclass : this.class;
    if (cls) document.querySelector(`${id} option[value='${cls.name}']`).disabled = true;
  }

  createSkillNodes(primary) {
    const sectionLayer = this._elements[primary ? 'classTree' : 'subclassTree'];
    while (sectionLayer.lastChild) sectionLayer.removeChild(sectionLayer.lastChild);
    const section = primary ? 'primary' : 'secondary';

    const cls = primary ? this.class : this.subclass;
    if (!cls) return;

    for (const skill of cls.skills.values()) if (!skill.unique || primary) this.drawLines(sectionLayer, skill);

    for (const skill of cls.skills.values()) this.drawLevel(sectionLayer, skill);

    for (const [skillName, skill] of cls.skills) {
      const skillId = `skill-${cls.name}-${skillName}`;
      let skillMax = skill.maxLevel;
      if (!primary) skillMax /= this.secondaryPenalty;

      skill.level = 0;
      if (skill.unique && !primary) continue;

      let a = true;

      for (const level of skill.prereqs.values()) {
        if (level === 0) continue;
        a = false;
        break;
      }

      let node = document.createElement("div");
      node.classList.add("skill");
      node.classList.add(`skill-${section}`);
      node.classList.add(`skill-${(a ? '' : 'un') + 'available'}`);
      node.id = skillId;

      node.style.setProperty('--skill-x-pos', skill.coords.x);
      node.style.setProperty('--skill-y-pos', skill.coords.y);

      let nameDiv = document.createElement("div");
      nameDiv.classList.add("skill-name");
      nameDiv.classList.add("skill-name-en");
      nameDiv.textContent = skill.name;
      node.appendChild(nameDiv);

      let levelNode = document.createElement("div");

      levelNode.classList.add("skill-type");

      if (["Boost", "Break"].includes(skill.type)) {
        levelNode.classList.add("skill-type-special");
        levelNode.textContent = skill.type.toUpperCase();
      } else {
        levelNode.classList.add("skill-type-normal");

        let currentLevel = document.createElement("div");
        currentLevel.classList.add("skill-current-level");
        currentLevel.textContent = "0";
        levelNode.appendChild(currentLevel);

        let maxLevel = document.createElement("div");
        maxLevel.classList.add("skill-max-level");
        maxLevel.textContent = skillMax;
        levelNode.appendChild(maxLevel);
      }

      node.appendChild(levelNode);

      sectionLayer.appendChild(node);
    }

    const nodes = document.querySelectorAll(`.skill-${section}.skill`);

    for (const node of nodes) {
      node.addEventListener("click", () => {
        const [,className, skillName] = node.id.split("-");
        const skill = this.#classes.get(className).skills.get(skillName);
        let max = skill.maxLevel;

        if (!primary) max /= this.secondaryPenalty;

        skill.level = Math.min(skill.level + 1, max);
      });

      node.addEventListener("contextmenu", e => {
        e.preventDefault();
        const [,className, skillName] = node.id.split("-");
        const skill = this.#classes.get(className).skills.get(skillName);

        skill.level = Math.max(skill.level - 1, 0);
      });

      node.addEventListener("mouseenter", () => this.createInfoNode(section, node));

      node.addEventListener("mouseleave", () => this.removeInfoNode());
    }
  }

  createInfoNode(section, node) {
    this.removeInfoNode();

    let [,className, skillName] = node.id.split("-");
    const skill = this.#classes.get(className).skills.get(skillName);

    let levelInfo = skill.levels;
    let maxLevel = 2;

    try {
      levelInfo = skill.levels;
      maxLevel = Object.values(levelInfo)[0].length;
    } catch (error) { }

    let tableLength = 2 + maxLevel;

    let skillInfo = document.createElement("div");
    skillInfo.classList.add("skill-info");

    let infoTable = document.createElement("table");

    let nameTitleRow = document.createElement("tr");

    let enNameTitle = document.createElement("th");
    enNameTitle.textContent = "Name";
    enNameTitle.colSpan = 2;
    nameTitleRow.appendChild(enNameTitle);

    let usesTitle = document.createElement("th");
    usesTitle.textContent = "Uses";
    usesTitle.colSpan = maxLevel;
    nameTitleRow.appendChild(usesTitle);

    infoTable.appendChild(nameTitleRow);

    let nameRow = document.createElement("tr");

    let enName = document.createElement("td");
    enName.textContent = skill.name;
    enName.colSpan = 2;
    nameRow.appendChild(enName);

    let usesText = skill.stats.join(", ") || "N/A";

    let uses = document.createElement("td");
    uses.textContent = usesText;
    uses.colSpan = tableLength - 2;
    nameRow.appendChild(uses);

    infoTable.appendChild(nameRow);

    let descriptionRow = document.createElement("tr");

    let description = document.createElement("td");
    description.classList.add("skill-description");
    description.colSpan = tableLength;
    descriptionRow.appendChild(description);

    infoTable.appendChild(descriptionRow);

    if (levelInfo) {
      let curLevel = skill.level;
      let levelHeader = document.createElement("tr");

      let levelType = document.createElement("th");
      levelType.textContent = ["Boost", "Break"].includes(skill.type) ? "Stage" : "Level";
      levelType.colSpan = 2;
      levelHeader.appendChild(levelType);

      for (let i of [...Array(maxLevel).keys()].map(i => ++i)) {
        let level = document.createElement("th");
        level.textContent = i.toString();
        if (i === curLevel) level.classList.add("info-current-level");
        levelHeader.appendChild(level);
      }
      infoTable.appendChild(levelHeader);

      for (let [attName, attValues] of Object.entries(levelInfo)) {
        let attributeRow = document.createElement("tr");
        let attributeName = document.createElement("th");
        attributeName.textContent = attName;
        attributeName.colSpan = 2;
        attributeRow.appendChild(attributeName);

        let currentLevel = 0;
        while (currentLevel + 1 <= attValues.length) {
          let attributeCell = document.createElement("td");
          let attributeValue = attValues[currentLevel];
          let colspan = 1;

          while (attValues[++currentLevel] === attributeValue) ++colspan;

          if (curLevel >= currentLevel + 1 - colspan && currentLevel + 1 > curLevel) attributeCell.classList.add("info-current-level");

          attributeCell.colSpan = colspan;
          attributeCell.textContent = attributeValue;
          attributeRow.appendChild(attributeCell);
        }
        infoTable.appendChild(attributeRow);
      }
    }
    skillInfo.appendChild(infoTable);

    let skillNode = document.getElementById(`skill-${className}-${skillName}`);

    document.body.appendChild(skillInfo);

    let skillRect = skillNode.getBoundingClientRect();
    let infoRect = skillInfo.getBoundingClientRect();

    let width = infoRect.width;

    let posX = skillRect.left + 7 + window.scrollX;
    let posY = skillRect.top + nodeHeight + verticalPadding + window.scrollY;

    if (window.innerWidth < posX + width) posX = window.innerWidth + window.scrollX - width - 17;

    skillInfo.style.width = `${width}px`;
    skillInfo.style.left = `${posX}px`;

    description.textContent = skill.description;

    infoRect = skillInfo.getBoundingClientRect();
    let height = infoRect.height;

    if (window.innerHeight < posY + height) posY = skillRect.top + window.scrollY - height - verticalPadding + 5;
    skillInfo.style.top = `${posY}px`;
  }

  removeInfoNode() {
    let info = document.querySelector(".skill-info");

    if (info) document.body.removeChild(info);
  }

  drawLines(tree, skill) {
    const prereqs = skill.prereqs;
    const forwards = skill.forwards;
    const {x, y} = skill.coords;

    if (forwards.size) {
      const forwardX = forwards.keys().next().value.coords.x;

      this.drawHorizontalLine(tree, x, y, forwardX);

      if (forwards.size > 1) {
        const {0: minY, length, [length - 1]: maxY} = [...forwards.keys()].map(forward => forward.coords.y).sort();

        this.drawVerticalLine(tree, forwardX, minY, maxY);
      }
    }

    if (prereqs.size) {
      this.drawHorizontalLine(tree, x, y);

      if (prereqs.size > 1) {
        const {0: minY, length, [length - 1]: maxY} = [...prereqs.keys()].map(prereq => prereq.coords.y).sort();

        this.drawVerticalLine(tree, x, minY, maxY);
      }
    }
  }

  drawLevel(tree, skill) {
    const forwards = skill.forwards;
    if (!forwards.size) return;

    const level = forwards.values().next().value;
    if (!level) return;

    const {x, y} = skill.coords;

    const levelReq = document.createElement('span');
    levelReq.textContent = `Lv${level}`;
    levelReq.classList.add('level-req');
    levelReq.style.setProperty('--level-x-pos', x);
    levelReq.style.setProperty('--level-y-pos', y);
    tree.appendChild(levelReq);
  }

  drawVerticalLine(tree, x, minY, maxY) {
    const line = document.createElement('div');
    line.classList.add('line', 'vertical-line');
    line.style.setProperty('--vertical-line-x-pos', x);
    line.style.setProperty('--vertical-line-min-y-pos', minY);
    line.style.setProperty('--vertical-line-max-y-pos', maxY);
    tree.appendChild(line);
  }

  drawHorizontalLine(tree, x, y, forwardX) {
    const isDep = forwardX === undefined;

    const line = document.createElement('div');
    line.classList.add('line', 'horizontal-line', isDep ? 'dep-line' : 'forward-line');
    line.style.setProperty('--line-x-pos', x);
    if (!isDep) line.style.setProperty('--line-x-end-pos', forwardX);
    line.style.setProperty('--line-y-pos', y);
    tree.appendChild(line);
  }

  updateNodes(primary) {
    const cls = primary ? this.class : this.subclass;

    if (!cls) return;

    for (const [skillName, skill] of cls.skills) {
      const skillNode = document.getElementById(`skill-${cls.name}-${skillName}`);
      if (!skillNode) continue;

      let a = true;
      for (const [depSkill, depLevel] of skill.prereqs) {
        if (depSkill.level < depLevel) {
          a = false;
          break;
        }
      }

      if (["Boost", "Break"].includes(skill.type)) continue;

      skillNode.childNodes[1].childNodes[0].textContent = skill.level.toString();

      skillNode.classList.remove(`skill-available`);
      skillNode.classList.remove(`skill-unavailable`);
      skillNode.classList.add(`skill-${(a ? '' : 'un') + 'available'}`);
    }
    this.updateSkillPoints();
  }

  updateSkillPoints() {
    let points = 2 + this.level;

    if (this.subclass) points += 5;

    if (this.retireLevel !== 'N/A') points += this.retireBonuses[this._retireLevel][2];

    this._elements.pointsTotal.textContent = points.toString();

    let pointsUsed = 0;

    for (const cls of this.#classes.values()) {
      for (const skill of cls.skills.values()) pointsUsed += skill.level;
    }

    this._elements.pointsUsed.textContent = pointsUsed.toString();
  }
}


export default Simulator;
