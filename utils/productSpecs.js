export const MAX_PRODUCT_SPECS = 30
export const MAX_SPEC_NAME_LENGTH = 80
export const MAX_SPEC_VALUE_LENGTH = 500

export function normalizeProductSpecs(specs) {
  const normalizedSpecs = (Array.isArray(specs) ? specs : [])
    .map((spec) => ({
      spec_name: String(spec?.spec_name || '').trim(),
      spec_value: String(spec?.spec_value || '').trim(),
    }))
    .filter((spec) => spec.spec_name || spec.spec_value)

  if (normalizedSpecs.length > MAX_PRODUCT_SPECS) {
    throw new Error(`A product can have up to ${MAX_PRODUCT_SPECS} specifications.`)
  }
  if (normalizedSpecs.some((spec) => !spec.spec_name || !spec.spec_value)) {
    throw new Error('Each specification requires both a name and a value.')
  }
  if (normalizedSpecs.some((spec) => spec.spec_name.length > MAX_SPEC_NAME_LENGTH)) {
    throw new Error(`Specification names cannot exceed ${MAX_SPEC_NAME_LENGTH} characters.`)
  }
  if (normalizedSpecs.some((spec) => spec.spec_value.length > MAX_SPEC_VALUE_LENGTH)) {
    throw new Error(`Specification values cannot exceed ${MAX_SPEC_VALUE_LENGTH} characters.`)
  }

  return normalizedSpecs
}
