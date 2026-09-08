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
} from 'antd';
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
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [prevQuery, setPrevQuery] = useState(query);
  const [categoryId, setCategoryId] = useState<number | null>(null);
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

  function handleCategoryChange(id: number | null) {
    setCategoryId(id);
    setPage(0);
  }

  function handlePriceApply(min: number | undefined, max: number | undefined) {
    setPriceMin(min);
    setPriceMax(max);
    setPage(0);
  }

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

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : result?.content.length === 0 ? (
          <Empty description="No products match your filters." />
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
