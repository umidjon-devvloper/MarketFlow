/**
 * Sotuvchining kategoriya taksonomiyasi (1-rasm) — tez-tanlov uchun.
 *
 * Har element WB katalogidagi qidiruv atamasi: bosilganда CategoryPicker shu
 * atama bo'yicha qidiradi va aniq WB predmetini (subjectID) tanlaydi. Bu hard
 * qadab qo'yilgan ID emas — katalogdan tirik topiladi, shuning uchun WB
 * o'zgartirса ham buzilmaydi.
 */

export interface PresetGroup {
  label: string;
  items: string[];
}

export const WB_CATEGORY_PRESET: PresetGroup[] = [
  {
    label: 'Одежда',
    items: [
      'Сарафаны',
      'Костюмы',
      'Халаты домашние',
      'Пижамы',
      'Пиджаки',
      'Платья',
      'Кардиганы',
      'Жакеты',
      'Комбинезоны для малышей',
    ],
  },
  { label: 'Головные уборы', items: ['Кепи', 'Шапки-ушанки'] },
  { label: 'Для праздника', items: ['Карнавальные маски'] },
  { label: 'Игрушки', items: ['Мягкие игрушки'] },
  { label: 'Аксессуары', items: ['Рюкзаки', 'Сумки'] },
  {
    label: 'Текстиль для дома',
    items: ['Подушки', 'Скатерти', 'Постельное белье для малышей', 'Ковры'],
  },
  { label: 'Мебель малых форм', items: ['Табуреты', 'Шкатулки', 'Сувениры религиозные'] },
  {
    label: 'Посуда и инвентарь',
    items: ['Тарелки декоративные', 'Наборы для чаепития', 'Доски сервировочные'],
  },
  {
    label: 'Декор интерьера',
    items: ['Шкатулки', 'Картины модульные', 'Фигурки и статуэтки', 'Тарелки декоративные'],
  },
];
