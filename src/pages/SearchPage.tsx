import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Layout,
  Typography,
  Select,
  Pagination,
  Spin,
  Empty,
  Divider,
  Button,
  Space,
  Tag,
} from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import client from '../api/client';
import type { Product, PagedResult } from '../api/types';
import ProductCard from '../components/ProductCard';
import CategoryTree from '../components/CategoryTree';
import PriceRangeFilter from '../components/PriceRangeFilter';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A–Z' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [prevQuery, setPrevQuery] = useState(query);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<number | undefined>();
  const [priceMax, setPriceMax] = useState<number | undefined>();
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(0);

  const [result, setResult] = useState<PagedResult<Product> | null>(null);
  const [loading, setLoading] = useState(false);

  // The query comes from the URL (header search box), so it can change without going
  // through a handler. Reset the page during render rather than in an effect — an effect
  // would let one fetch fire with the stale page before the reset triggers a second.
  if (query !== prevQuery) {
    setPrevQuery(query);
    setPage(0);
    // A new search term starts a fresh lookup, so drop the category — a stale one
    // silently narrows the results, often to nothing. Not symmetric: picking a
    // category refines the current search and leaves the term alone. Clearing the
    // term is not a new search either, so it leaves the sidebar untouched.
    if (query) {
      setCategoryId(null);
      setCategoryName(null);
    }
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), size: '10', sort };
      if (query) params.search = query;
      if (categoryId) params.category = String(categoryId);
      if (priceMin !== undefined) params.priceMin = String(priceMin);
      if (priceMax !== undefined) params.priceMax = String(priceMax);

      const { data } = await client.get<PagedResult<Product>>('/products', { params });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, priceMin, priceMax, sort, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleCategoryChange(id: number | null, name: string | null) {
    setCategoryId(id);
    setCategoryName(name);
    setPage(0);
  }

  function handlePriceApply(min: number | undefined, max: number | undefined) {
    setPriceMin(min);
    setPriceMax(max);
    setPage(0);
  }

  /** Drop the search term but keep the sidebar filters. */
  function clearSearchTerm() {
    setSearchParams({}, { replace: true });
    setPage(0);
  }

  /** Back to the unfiltered catalog — term, category and price range all dropped. */
  function clearAll() {
    setSearchParams({}, { replace: true });
    setCategoryId(null);
    setCategoryName(null);
    setPriceMin(undefined);
    setPriceMax(undefined);
    setPage(0);
  }

  const hasFilters = Boolean(query) || categoryId !== null || priceMin !== undefined || priceMax !== undefined;

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', background: '#f0f2f5' }}>
      <Sider
        width={220}
        style={{
          background: '#fff',
          padding: '16px 12px',
          overflowY: 'auto',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          Category
        </Text>
        <div style={{ marginTop: 8 }}>
          <CategoryTree selectedId={categoryId} onChange={handleCategoryChange} />
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <PriceRangeFilter priceMin={priceMin} priceMax={priceMax} onApply={handlePriceApply} />
      </Sider>

      <Content style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>
            {query ? `Results for "${query}"` : 'All products'}
            {result && (
              <Text type="secondary" style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                ({result.totalElements} found)
              </Text>
            )}
          </Title>
          <Select
            value={sort}
            options={SORT_OPTIONS}
            onChange={(v) => { setSort(v); setPage(0); }}
            style={{ width: 180 }}
            size="small"
          />
        </div>

        {/* Active filters — each removable on its own, plus one reset back to the
            full catalog. Without this there is no way out of a search term: the
            term lives in the URL, so the sidebar's own resets cannot clear it. */}
        {hasFilters && (
          <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
            {query && (
              <Tag closable onClose={clearSearchTerm} color="blue">
                Search: {query}
              </Tag>
            )}
            {categoryId !== null && (
              <Tag closable onClose={() => handleCategoryChange(null, null)} color="blue">
                Category: {categoryName ?? categoryId}
              </Tag>
            )}
            {(priceMin !== undefined || priceMax !== undefined) && (
              <Tag closable onClose={() => handlePriceApply(undefined, undefined)} color="blue">
                Price: {priceMin !== undefined ? `$${priceMin}` : 'any'} –{' '}
                {priceMax !== undefined ? `$${priceMax}` : 'any'}
              </Tag>
            )}
            {/* Terse here — it sits beside the tags that already say what is set.
                The empty state has room to spell out what clearing will do. */}
            <Button size="small" type="link" icon={<CloseCircleOutlined />} onClick={clearAll}>
              Clear all
            </Button>
          </Space>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : result?.content.length === 0 ? (
          <Empty description="No products match your filters.">
            {hasFilters && (
              <Button type="primary" icon={<CloseCircleOutlined />} onClick={clearAll}>
                Clear all and show every product
              </Button>
            )}
          </Empty>
        ) : (
          <>
            {result?.content.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            {result && result.totalElements > 10 && (
              <Pagination
                current={page + 1}
                total={result.totalElements}
                pageSize={10}
                onChange={(p) => setPage(p - 1)}
                style={{ textAlign: 'center', marginTop: 16 }}
                showTotal={(total) => `${total} products`}
              />
            )}
          </>
        )}
      </Content>
    </Layout>
  );
}
