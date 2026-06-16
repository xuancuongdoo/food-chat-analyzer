import { NutritionData, NutrientValue } from '@/types/nutrition'

interface Props {
  data: NutritionData
}

function fmt(v: NutrientValue | { amount: number; unit: string }): string {
  return `${v.amount}${v.unit}`
}

function dv(v: NutrientValue): string {
  return v.dailyValue != null ? `${v.dailyValue}%` : ''
}

// FDA label uses specific border thicknesses:
// thick = 8px (after Nutrition Facts title, after calories block)
// medium = 4px (before % DV section, before vitamins, after vitamins)
// thin = 1px (between individual nutrients)

function ThickDivider() {
  return <div style={{ borderTopWidth: '8px', borderTopStyle: 'solid', borderTopColor: '#000', margin: '2px 0' }} />
}

function MediumDivider() {
  return <div style={{ borderTopWidth: '4px', borderTopStyle: 'solid', borderTopColor: '#000', margin: '2px 0' }} />
}

function ThinDivider() {
  return <div style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#aaa', margin: 0 }} />
}

interface NutrientRowProps {
  label: string
  amount: string
  percent?: string
  bold?: boolean
  indent?: boolean
  smallText?: boolean
  noDivider?: boolean
}

function NutrientRow({
  label,
  amount,
  percent,
  bold = false,
  indent = false,
  smallText = false,
  noDivider = false,
}: NutrientRowProps) {
  const fontSize = smallText ? '11px' : '13px'
  const fontWeight = bold ? 700 : 400

  return (
    <>
      {!noDivider && <ThinDivider />}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingTop: '2px',
          paddingBottom: '2px',
          paddingLeft: indent ? '20px' : '0',
        }}
      >
        <span style={{ fontSize, fontWeight, color: '#000', lineHeight: 1.3 }}>
          {label}{' '}
          <span style={{ fontSize, fontWeight: 400, color: '#000' }}>{amount}</span>
        </span>
        {percent != null && (
          <span style={{ fontSize, fontWeight: 700, color: '#000', whiteSpace: 'nowrap', marginLeft: '8px' }}>
            {percent}
          </span>
        )}
      </div>
    </>
  )
}

export default function NutritionLabel({ data }: Props) {
  const d = data
  return (
    <div
      style={{
        border: '2px solid #000',
        backgroundColor: '#fff',
        padding: '8px',
        maxWidth: '300px',
        width: '100%',
        fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: '38px',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-0.5px',
          color: '#000',
          margin: 0,
          marginBottom: '2px',
        }}
      >
        Nutrition Facts
      </h2>

      {/* Servings */}
      <div style={{ fontSize: '13px', color: '#000', lineHeight: 1.4 }}>
        {d.servingsPerContainer && (
          <div>{d.servingsPerContainer} servings per container</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Serving size</span>
          <span>{d.servingSize}</span>
        </div>
      </div>

      <ThickDivider />

      {/* Calories */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', lineHeight: 1 }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#000' }}>Amount per serving</div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#000', lineHeight: 1.15 }}>Calories</div>
        </div>
        <div style={{ fontSize: '60px', fontWeight: 900, color: '#000', lineHeight: 1 }}>{d.calories}</div>
      </div>

      <MediumDivider />

      {/* % DV header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 0' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#000' }}>% Daily Value*</span>
      </div>

      {/* Macros */}
      <NutrientRow label="Total Fat" amount={fmt(d.totalFat)} percent={dv(d.totalFat)} bold noDivider />
      <NutrientRow label="Saturated Fat" amount={fmt(d.saturatedFat)} percent={dv(d.saturatedFat)} indent />
      <NutrientRow label="Trans Fat" amount={fmt(d.transFat)} indent />
      <NutrientRow label="Cholesterol" amount={fmt(d.cholesterol)} percent={dv(d.cholesterol)} bold />
      <NutrientRow label="Sodium" amount={fmt(d.sodium)} percent={dv(d.sodium)} bold />
      <NutrientRow label="Total Carbohydrate" amount={fmt(d.totalCarbs)} percent={dv(d.totalCarbs)} bold />
      <NutrientRow label="Dietary Fiber" amount={fmt(d.dietaryFiber)} percent={dv(d.dietaryFiber)} indent />
      <NutrientRow label="Total Sugars" amount={fmt(d.totalSugars)} indent />
      <NutrientRow
        label="Includes Added Sugars"
        amount={fmt(d.addedSugars)}
        percent={dv(d.addedSugars)}
        indent
        smallText
      />
      <NutrientRow label="Protein" amount={fmt(d.protein)} bold />

      <ThickDivider />

      {/* Vitamins & Minerals */}
      <NutrientRow label="Vitamin D" amount={fmt(d.vitaminD)} percent={dv(d.vitaminD)} noDivider />
      <NutrientRow label="Calcium" amount={fmt(d.calcium)} percent={dv(d.calcium)} />
      <NutrientRow label="Iron" amount={fmt(d.iron)} percent={dv(d.iron)} />
      <NutrientRow label="Potassium" amount={fmt(d.potassium)} percent={dv(d.potassium)} />

      <MediumDivider />

      {/* Footer */}
      <p style={{ fontSize: '9px', color: '#000', lineHeight: 1.4, margin: '4px 0 0 0' }}>
        * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a
        daily diet. 2,000 calories a day is used for general nutrition advice.
      </p>
    </div>
  )
}
