import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

interface ListingTagsEditorProps {
  presets: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}

export default function ListingTagsEditor({
  presets,
  value,
  onChange,
  error,
}: ListingTagsEditorProps) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={presets}
      value={value}
      onChange={(_, newValue) => {
        const next = newValue
          .map((t) => String(t).trim())
          .filter(Boolean);
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const t of next) {
          const key = t.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(t.length > 40 ? t.slice(0, 40) : t);
          if (deduped.length >= 20) break;
        }
        onChange(deduped);
      }}
      renderTags={(tagValues, getTagProps) =>
        tagValues.map((option, index) => (
          <Chip {...getTagProps({ index })} key={`${option}-${index}`} label={option} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Tags"
          placeholder="Add tags"
          helperText={
            error ||
            "Choose presets below or type custom tags. Remove a tag with ×."
          }
          error={Boolean(error)}
        />
      )}
    />
  );
}
