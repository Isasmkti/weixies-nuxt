import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import test from 'node:test'
import { createPinia, defineStore, setActivePinia } from 'pinia'

async function loadModule(path, dependencies, globals = {}) {
  const context = createContext({ console, ...globals })
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context })
  await module.link(specifier => {
    const exports = dependencies[specifier]
    if (!exports) throw new Error(`Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}

async function loadCreateCategoryHandler({ existingCategory = null, duplicateCheckError = null } = {}) {
  let insertedPayload = null
  let activityRecorded = false
  let checkedPattern = null
  const createdCategory = { id: 8, name: 'Design Kit', slug: 'design-kit', created_at: 'now' }
  const supabase = {
    from(table) {
      assert.equal(table, 'categories')
      return {
        select(columns) {
          assert.equal(columns, 'id')
          return {
            ilike(column, pattern) {
              assert.equal(column, 'name')
              checkedPattern = pattern
              return {
                limit(count) {
                  assert.equal(count, 1)
                  return {
                    maybeSingle: async () => ({ data: existingCategory, error: duplicateCheckError }),
                  }
                },
              }
            },
          }
        },
        insert(payload) {
          insertedPayload = payload
          return {
            select: () => ({
              single: async () => ({ data: createdCategory, error: null }),
            }),
          }
        },
      }
    },
  }
  const contextGlobals = {
    defineEventHandler: handler => handler,
    readBody: async event => event.body,
    createError: options => Object.assign(new Error(options.statusMessage), options),
  }
  const namespace = await loadModule('../server/api/admin/categories/index.post.ts', {
    '~/server/utils/admin-auth': { requirePlatformAdmin: async () => ({ user: { id: 'admin' } }) },
    '~/server/utils/supabase-admin': { useSupabaseAdmin: () => supabase },
    '~/server/utils/category-input': {
      normalizeCategoryInput: input => ({
        name: String(input.name).trim(),
        slug: String(input.slug).trim(),
      }),
      categoryDatabaseError: (error, fallback) => {
        throw Object.assign(new Error(fallback), { statusCode: 500, code: error.code })
      },
    },
    '~/server/utils/admin-activity': {
      recordAdminActivity: async () => { activityRecorded = true },
    },
  }, contextGlobals)

  return {
    handler: namespace.default,
    getInsertedPayload: () => insertedPayload,
    getActivityRecorded: () => activityRecorded,
    getCheckedPattern: () => checkedPattern,
  }
}

test('category create rejects a case-insensitive duplicate name before insert', async () => {
  const { handler, getInsertedPayload } = await loadCreateCategoryHandler({
    existingCategory: { id: 3 },
  })

  await assert.rejects(
    handler({ body: { name: 'Design Kit', slug: 'design-kit' } }),
    error => error.statusCode === 409 && error.statusMessage === 'A category with this name already exists.',
  )
  assert.equal(getInsertedPayload(), null)
})

test('category create escapes LIKE characters, inserts once and records admin activity', async () => {
  const { handler, getInsertedPayload, getActivityRecorded, getCheckedPattern } = await loadCreateCategoryHandler()

  const response = await handler({ body: { name: 'Design 100%_Kit', slug: 'design-kit' } })

  assert.equal(getCheckedPattern(), 'Design 100\\%\\_Kit')
  assert.deepEqual(getInsertedPayload(), { name: 'Design 100%_Kit', slug: 'design-kit' })
  assert.equal(response.category.id, 8)
  assert.equal(response.category.product_count, 0)
  assert.equal(getActivityRecorded(), true)
})

test('category create reports duplicate-check database failures', async () => {
  const { handler, getInsertedPayload } = await loadCreateCategoryHandler({
    duplicateCheckError: { code: 'DB_DOWN' },
  })

  await assert.rejects(
    handler({ body: { name: 'Design Kit', slug: 'design-kit' } }),
    error => error.statusCode === 500 && error.statusMessage === 'Category could not be created.',
  )
  assert.equal(getInsertedPayload(), null)
})

test('quick-created categories are inserted into the shared category store in sorted order', async () => {
  setActivePinia(createPinia())
  const { useCategoriesStore } = await loadModule('../stores/categoriesStore.js', {
    pinia: { defineStore },
    '../services/categoriesService': { sAll: async () => [] },
  })
  const store = useCategoriesStore()
  store.categories = [{ id: 1, name: 'Art' }, { id: 4, name: 'UI' }]
  store.upsertCategory({ id: 3, name: 'Design' })

  assert.equal([...store.categories].map(category => category.name).join(','), 'Art,Design,UI')
  assert.equal(store.fetchedAt > 0, true)
})
