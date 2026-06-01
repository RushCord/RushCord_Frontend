export const THEMES = ["light", "dark", "cupcake", "retro", "valentine", "nord"];

export const DEFAULT_THEME = "dark";

export const THEME_OPTIONS = [
  {
    id: "light",
    label: "Light",
    description: "Sáng, giao diện Discord-style",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Tối, dễ nhìn ban đêm",
  },
  {
    id: "cupcake",
    label: "Cupcake",
    description: "Pastel nhẹ, tông ấm",
  },
  {
    id: "retro",
    label: "Retro",
    description: "Cổ điển, xanh lá nhẹ",
  },
  {
    id: "valentine",
    label: "Valentine",
    description: "Hồng pastel, dịu mắt",
  },
  {
    id: "nord",
    label: "Nord",
    description: "Xanh xám Bắc Âu, trầm",
  },
];

export const isAllowedTheme = (id) => THEMES.includes(id);

export const normalizeTheme = (id) => (isAllowedTheme(id) ? id : DEFAULT_THEME);
