-- AIVAULT / Dark Star compute capability recognition v1
-- Additive only. Does not modify Dark Star UI or realtime voice.
-- Recognizes heterogeneous compute families such as Apple Neural Engine/Metal/MLX
-- and NVIDIA CUDA/Tensor Core, then ranks eligible compute-mesh nodes.

alter table public.compute_mesh_nodes
  add column if not exists platform text,
  add column if not exists runtime text,
  add column if not exists memory_gb numeric,
  add column if not exists accelerator jsonb not null default '{}'::jsonb;

create or replace function public.darkstar_normalize_compute_capability(
  p_platform text default null,
  p_gpu jsonb default '{}'::jsonb,
  p_capability jsonb default '{}'::jsonb,
  p_accelerator jsonb default '{}'::jsonb,
  p_memory_gb numeric default null
) returns jsonb
language sql
security invoker
stable
as $$
  with src as (
    select lower(
      coalesce(p_platform,'') || ' ' ||
      coalesce(p_gpu::text,'') || ' ' ||
      coalesce(p_capability::text,'') || ' ' ||
      coalesce(p_accelerator::text,'')
    ) as s
  )
  select jsonb_build_object(
    'platform_family',
      case
        when s like '%iphone%' or s like '%ios%' then 'apple_mobile'
        when s like '%mac%' or s like '%macos%' or s like '%apple silicon%' or s like '%apple%' then 'apple_silicon'
        when s like '%nvidia%' or s like '%cuda%' or s like '%rtx%' or s like '%h100%' or s like '%h200%' or s like '%b200%' then 'nvidia'
        when s like '%amd%' or s like '%rocm%' or s like '%radeon%' then 'amd'
        else 'unknown'
      end,
    'accelerators',
      to_jsonb(array_remove(ARRAY[
        case when s like '%neural engine%' or s like '%neural_engine%' or s like '%npu%' then 'neural_engine'::text end,
        case when s like '%cuda%' or s like '%tensor core%' or s like '%tensor_core%' then 'cuda_tensor'::text end,
        case when s like '%metal%' or s like '%mlx%' or s like '%apple silicon%' or s like '%macos%' then 'metal_mlx'::text end,
        case when s like '%rocm%' then 'rocm'::text end,
        case when s like '%webgpu%' then 'webgpu'::text end
      ], null)),
    'memory_gb', coalesce(p_memory_gb, nullif(regexp_replace(
      coalesce(p_gpu->>'memory_gb', p_capability->>'memory_gb', p_capability->>'device_memory_gb',''),
      '[^0-9.]','','g'
    ), '')::numeric),
    'ai_role',
      case
        when s like '%neural engine%' or s like '%neural_engine%' or s like '%npu%' then 'ai_accelerator'
        when s like '%tensor core%' or s like '%cuda%' then 'gpu_ai_accelerator'
        when s like '%webgpu%' then 'browser_gpu'
        else 'general_compute'
      end,
    'recognition_version', 'darkstar-compute-capability-v1'
  )
  from src;
$$;

revoke execute on function public.darkstar_normalize_compute_capability(text,jsonb,jsonb,jsonb,numeric) from public, anon;
grant execute on function public.darkstar_normalize_compute_capability(text,jsonb,jsonb,jsonb,numeric) to authenticated;

create or replace function public.darkstar_rank_compute_nodes(
  p_task_profile jsonb default '{}'::jsonb
) returns table(
  node_id text,
  score numeric,
  platform_family text,
  accelerators jsonb,
  memory_gb numeric,
  ai_role text,
  reasons jsonb
)
language sql
security invoker
stable
as $$
  with nodes as (
    select
      n.node_id, n.gpu, n.capability, n.available, n.status, n.last_seen,
      public.darkstar_normalize_compute_capability(
        n.platform,n.gpu,n.capability,n.accelerator,n.memory_gb
      ) as cap
    from public.compute_mesh_nodes n
    where coalesce(n.available,false) = true
      and n.status in ('READY','AVAILABLE','IDLE','ONLINE')
  )
  select
    node_id,
    round((
      case when coalesce((cap->>'memory_gb')::numeric,0) >= coalesce((p_task_profile->>'min_memory_gb')::numeric,0)
           then 40 else 0 end
      + case
          when lower(coalesce(p_task_profile->>'preferred_accelerator','')) = 'neural_engine'
               and cap->'accelerators' ? 'neural_engine' then 30
          when lower(coalesce(p_task_profile->>'preferred_accelerator','')) = 'cuda_tensor'
               and cap->'accelerators' ? 'cuda_tensor' then 30
          when lower(coalesce(p_task_profile->>'preferred_accelerator','')) = 'metal_mlx'
               and cap->'accelerators' ? 'metal_mlx' then 30
          when lower(coalesce(p_task_profile->>'preferred_accelerator','')) = '' then 10
          else 0
        end
      + case
          when lower(coalesce(p_task_profile->>'task_family','')) in ('llm','reasoning','coding')
               and cap->>'ai_role' in ('ai_accelerator','gpu_ai_accelerator') then 20
          when lower(coalesce(p_task_profile->>'task_family','')) in ('vision','image')
               and cap->'accelerators' ? 'webgpu' then 15
          else 0
        end
      + case when last_seen is not null and last_seen > now() - interval '2 minutes' then 10 else 0 end
    )::numeric,2) as score,
    cap->>'platform_family',
    cap->'accelerators',
    nullif(cap->>'memory_gb','')::numeric,
    cap->>'ai_role',
    jsonb_build_object(
      'task_family', p_task_profile->>'task_family',
      'preferred_accelerator', p_task_profile->>'preferred_accelerator',
      'memory_ok', coalesce((cap->>'memory_gb')::numeric,0) >= coalesce((p_task_profile->>'min_memory_gb')::numeric,0)
    )
  from nodes
  order by score desc, node_id;
$$;

revoke execute on function public.darkstar_rank_compute_nodes(jsonb) from public, anon;
grant execute on function public.darkstar_rank_compute_nodes(jsonb) to authenticated;
