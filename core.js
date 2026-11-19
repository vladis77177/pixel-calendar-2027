// Общий домен календаря: даты, склонения и правило повтора серий.
// Модуль не зависит от DOM и состояния приложения, поэтому один и тот же
// код работает в app.js, notifications.js, widget.js и в тестах node --test.
(function (root) {
  "use strict";

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function fromISO(iso) {
    const parts = String(iso).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isValidISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
    const date = fromISO(iso);
    return !Number.isNaN(date.getTime()) && toISO(date) === iso;
  }

  function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + amount);
    return result;
  }

  function addDaysIso(iso, days) {
    return toISO(addDays(fromISO(iso), days));
  }

  // Начало недели: weekStart === 0 — воскресенье, иначе понедельник.
  function startOfWeek(date, weekStart) {
    const startDay = weekStart === 0 ? 0 : 1;
    const result = startOfDay(date);
    result.setDate(result.getDate() - ((result.getDay() - startDay + 7) % 7));
    return result;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  // Оба стиля вызова: plural(n, [one, few, many]) и plural(n, one, few, many).
  function plural(n, forms, few, many) {
    const list = Array.isArray(forms) ? forms : [forms, few, many];
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return list[2];
    if (last > 1 && last < 5) return list[1];
    if (last === 1) return list[0];
    return list[2];
  }

  function isSeriesActiveOn(series, iso) {
    if (!series || series.deletedAt || !isValidISO(iso)) return false;
    if (iso < series.start) return false;
    if (series.end && iso > series.end) return false;
    const exception = series.exceptions && series.exceptions[iso];
    if (exception && exception.deleted) return false;
    const date = fromISO(iso);
    const start = fromISO(series.start);
    const diff = Math.round((date - start) / 86400000);
    if (diff < 0) return false;
    if (series.freq === "daily") return true;
    if (series.freq === "weekdays") return date.getDay() >= 1 && date.getDay() <= 5;
    if (series.freq === "weekly") return diff % 7 === 0 && date.getDay() === start.getDay();
    // День серии = день старта, но не больше числа дней в месяце:
    // серия с 31-го срабатывает и в феврале, и в апрельском последнем дне.
    if (series.freq === "monthly") return date.getDate() === Math.min(start.getDate(), daysInMonth(date));
    if (series.freq === "yearly") {
      return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
    }
    // Аддитивные частоты схемы v4: «каждые N дней» и свой набор дней недели.
    // interval/days приходят нормализованными (sync.js, loadStore); здесь только чтение,
    // но защиты от мусора остаются — серия с битым полем не должна «исчезать» молча.
    if (series.freq === "custom-days") {
      const step = Math.max(1, Math.floor(Number(series.interval) || 1));
      return diff % step === 0;
    }
    if (series.freq === "custom-weekdays") {
      const days = Array.isArray(series.days) ? series.days : [];
      return days.indexOf(date.getDay()) !== -1;
    }
    return false;
  }

  // Естественный ввод: «завтра в 15:00 позвонить маме» → дата, время и остаток текста.
  // Функция чистая: текущий день приходит аргументом, новые Date создаются только из
  // разобранных чисел, поэтому тесты не зависят от дня запуска.
  const MONTH_NAMES = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const WEEKDAY_INDEX = {
    понедельник: 1, вторник: 2, среда: 3, среду: 3, четверг: 4,
    пятница: 5, пятницу: 5, суббота: 6, субботу: 6, воскресенье: 0, воскресенье: 0,
    пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6, вс: 0
  };
  const DAY_PERIODS = { утра: "утра", дня: "дня", дня: "дня", вечера: "вечера", ночи: "ночи" };

  function parseClock(hour, minute) {
    const h = Number(hour);
    const m = minute == null ? 0 : Number(minute);
    if (!(h >= 0 && h <= 23) || !(m >= 0 && m <= 59)) return null;
    return `${pad2(h)}:${pad2(m)}`;
  }

  // Маркер части суток переводит час в 24-часовой вид.
  function applyDayPeriod(hour, period) {
    const h = Number(hour);
    if (!(h >= 0 && h <= 23)) return null;
    if (period === "утра") return h === 12 ? 0 : h;
    if (period === "дня" || period === "вечера") return h < 12 ? h + 12 : h;
    if (period === "ночи") return h === 12 ? 0 : h;
    return h;
  }

  function sameDayOrNext(year, month, day, base) {
    const candidate = new Date(year, month, day);
    if (candidate.getDate() !== day || candidate.getMonth() !== month) return null;
    if (candidate < base) candidate.setFullYear(candidate.getFullYear() + 1);
    return toISO(candidate);
  }

  function parseQuickInput(input, today) {
    const source = String(input == null ? "" : input);
    const base = today instanceof Date && !Number.isNaN(today.getTime()) ? startOfDay(today) : startOfDay(new Date());
    let rest = source;
    let dateIso = null;
    let time = null;

    // Вырезает найденный кусок и возвращает совпадение либо null.
    const cut = (regex) => {
      const match = regex.exec(rest);
      if (!match) return null;
      rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
      return match;
    };

    // 1. Дата словом: «12 декабря», «12 декабря 2027», «на 1 января».
    const monthPattern = new RegExp(
      `(?:^|\\s)(?:на\\s+)?(\\d{1,2})\\s+(${MONTH_NAMES.join("|")})(?:\\s+(\\d{4}))?(?=\\s|$|,|\\.)`,
      "i"
    );
    const monthMatch = cut(monthPattern);
    if (monthMatch) {
      const day = Number(monthMatch[1]);
      const month = MONTH_NAMES.indexOf(monthMatch[2].toLowerCase());
      const year = monthMatch[3] ? Number(monthMatch[3]) : base.getFullYear();
      const iso = sameDayOrNext(year, month, day, base);
      if (iso) dateIso = iso;
      else rest = `${rest} ${monthMatch[0]}`.trim();
    }

    // 2. Дата числами: «12.12», «12/12», «12.12.2027». Две цифры после точки
    // без четвёртого разряда (12.12.12) датой не считаем.
    if (!dateIso) {
      const numeric = cut(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?=\s|$|,)/);
      if (numeric) {
        const day = Number(numeric[1]);
        const month = Number(numeric[2]) - 1;
        const year = numeric[3] ? Number(numeric[3]) : base.getFullYear();
        const iso = sameDayOrNext(year, month, day, base);
        if (iso) dateIso = iso;
        else rest = `${rest} ${numeric[0]}`.trim();
      }
    }

    // 3. Относительные дни и «через N дней».
    if (!dateIso) {
      const offsets = { сегодня: 0, завтра: 1, послезавтра: 2, вчера: -1 };
      const relative = cut(/(?:^|\s)(послезавтра|завтра|сегодня|вчера)(?=\s|$|,)/i);
      if (relative) {
        dateIso = addDaysIso(toISO(base), offsets[relative[1].toLowerCase()]);
      } else {
        const inDays = cut(/(?:^|\s)через\s+(\d+)\s+(?:день|дня|дней)(?=\s|$|,)/i);
        if (inDays) dateIso = addDaysIso(toISO(base), Math.max(1, Number(inDays[1])));
        else if (cut(/(?:^|\s)через\s+неделю(?=\s|$|,)/i)) dateIso = addDaysIso(toISO(base), 7);
      }
    }

    // 4. Ближайший день недели строго в будущем («понедельник» в понедельник — через 7 дней).
    if (!dateIso) {
      const weekday = cut(/(?:^|\s)(?:в|во|на)?\s*(понедельник|вторник|среду|среда|среды|четверг|пятницу|пятница|субботу|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?=\s|$|,)/i);
      if (weekday) {
        const target = WEEKDAY_INDEX[weekday[1].toLowerCase()];
        if (target != null) {
          const delta = (target - base.getDay() + 7) % 7 || 7;
          dateIso = addDaysIso(toISO(base), delta);
        }
      }
    }

    // 5. Время с двоеточием: «15:00», «в 15:00».
    const clock = cut(/(?:^|\s)(?:в|во)?\s*(\d{1,2}):(\d{2})(?=\s|$|,)/);
    if (clock) time = parseClock(clock[1], clock[2]);

    // 6. Время с маркером части суток: «в 9 утра», «3 часа дня», «12 ночи».
    if (!time) {
      const period = cut(/(?:^|\s)(?:в|во)?\s*(\d{1,2})(?:[.,](\d{2}))?\s*(?:час(?:а|ов)?\s+)?(утра|дня|вечера|ночи)(?=\s|$|,)/i);
      if (period) {
        const hour = applyDayPeriod(period[1], DAY_PERIODS[period[3].toLowerCase()]);
        time = hour == null ? null : parseClock(hour, period[2] == null ? 0 : period[2]);
      }
    }

    // 7. Точка вместо двоеточия: «15.00» (даты уже вырезаны выше).
    if (!time) {
      const dotted = cut(/(?:^|\s)(\d{1,2})[.](\d{2})(?=\s|$|,)/);
      if (dotted) time = parseClock(dotted[1], dotted[2]);
    }

    // 8. «полдень» и «полночь».
    if (!time) {
      if (cut(/(?:^|\s)полдень(?=\s|$|,)/i)) time = "12:00";
      else if (cut(/(?:^|\s)полночь(?=\s|$|,)/i)) time = "00:00";
    }

    // 9. Голый час: «в 9» — утренняя трактовка.
    if (!time) {
      const bare = cut(/(?:^|\s)(?:в|во)\s+(\d{1,2})(?=\s|$|,)/);
      if (bare) time = parseClock(bare[1], 0);
    }

    let text = rest
      .replace(/\s+,/g, ",")
      .replace(/\s+/g, " ")
      .replace(/^[\s,.;:–—-]+/, "")
      .replace(/[\s,.;:–—-]+$/, "")
      .trim();
    // Одинокий предлог, оставшийся от вырезанной даты, делом не считается.
    if (/^(в|во|на|к|с|до)$/i.test(text)) text = "";

    return { date: dateIso, time, text };
  }

  // Фаза неба одна для приложения, виджета и раннего бутстрапа (boot.js):  // 5–8 рассвет, 8–17 день, 17–21 закат, иначе ночь.
  const SKY_PHASES = ["dawn", "day", "dusk", "night"];

  function skyPhaseFor(hour, mode) {
    if (mode && mode !== "auto") return SKY_PHASES.includes(mode) ? mode : "day";
    if (!(hour >= 0)) return "day";
    if (hour >= 5 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "dusk";
    return "night";
  }

  root.PixelCore = {
    toISO,
    fromISO,
    isValidISO,
    addDays,
    addDaysIso,
    startOfWeek,
    plural,
    isSeriesActiveOn,
    skyPhaseFor,
    parseQuickInput,
    SKY_PHASES
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.PixelCore;
})(typeof window !== "undefined" ? window : globalThis);
