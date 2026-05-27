import CountrySelect from "./CountrySelect";

type Props = {
  value: string;
  onChange: (cca3: string) => void;
  placeholder?: string;
  className?: string;
  clearPlacement?: "below" | "inline";
};

/** Highlight picker: same combobox as the dashboard country field, with optional clear. */
export default function HighlightCountrySelect({
  value,
  onChange,
  placeholder,
  className,
  clearPlacement = "below",
}: Props) {
  return (
    <CountrySelect
      value={value}
      onChange={onChange}
      variant="light"
      showLabel={false}
      allowClear
      clearPlacement={clearPlacement}
      placeholder={placeholder ?? "Search name, ISO3, or region…"}
      className={className}
    />
  );
}
