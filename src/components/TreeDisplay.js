import React, { useState, useEffect, useRef } from "react";
import { Tree, Input, Button } from "antd";

function TreeDisplay({ treeData, onChange }) {
  const [data, setData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [inputPos, setInputPos] = useState({ left: 0, top: 0, width: 0 });
  const treeRef = useRef();

  // 记录被删除节点的原父key，便于恢复
  const [deletedNodes, setDeletedNodes] = useState([]); // [{node, originParentKey}]

  useEffect(() => {
    if (treeData) {
      const initialData = Array.isArray(treeData) ? treeData : [treeData];
      setData(initialData);
      // 只在首次加载时设置展开，后续不再自动展开
      if (expandedKeys.length === 0) {
        const keys = [];
        const collectKeys = (nodes) => {
          nodes.forEach((node) => {
            if (node.key) keys.push(node.key);
            if (node.children && node.children.length) {
              collectKeys(node.children);
            }
          });
        };
        collectKeys(initialData);
        setExpandedKeys(keys);
      }
    }
  }, [treeData]);

  const onExpand = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
  };

  // 收起二级菜单，只展开根节点
  const collapseSecondLevel = () => {
    const rootKeys = data.map((node) => node.key);
    // 展开根节点和"已删除"节点
    setExpandedKeys([
      ...(rootKeys.includes("deleted-root") ? ["deleted-root"] : []),
      ...rootKeys.filter((k) => k !== "deleted-root"),
    ]);
  };

  const onDrop = (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split("-");
    const dropPosition =
      info.dropPosition - Number(dropPos[dropPos.length - 1]);

    const loop = (data, key, callback) => {
      for (let i = 0; i < data.length; i++) {
        if (data[i].key === key) {
          return callback(data[i], i, data);
        }
        if (data[i].children) {
          loop(data[i].children, key, callback);
        }
      }
    };

    const newData = [...data];

    // 查找拖拽节点及其位置
    let dragObj;
    loop(newData, dragKey, (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    if (!info.dropToGap) {
      // 放置到节点上 - 添加为子节点
      loop(newData, dropKey, (item) => {
        item.children = item.children || [];
        item.children.unshift(dragObj);
      });
    } else if (
      (info.node.props.children || []).length > 0 && // 有子节点
      info.node.props.expanded && // 展开
      dropPosition === 1 // 在第一个子节点之上
    ) {
      loop(newData, dropKey, (item) => {
        item.children = item.children || [];
        item.children.unshift(dragObj);
      });
    } else {
      let ar;
      let i;
      loop(newData, dropKey, (item, index, arr) => {
        ar = arr;
        i = index;
      });
      if (dropPosition === -1) {
        ar.splice(i, 0, dragObj);
      } else {
        ar.splice(i + 1, 0, dragObj);
      }
    }

    setData(newData);
    onChange(newData, deletedNodes);
  };

  // 删除节点及其子树
  const handleDelete = (key, parentKey = null) => {
    const removeNode = (nodes, key) => {
      let removed = null;
      const filtered = nodes.filter((node) => {
        if (node.key === key) {
          removed = node;
          return false;
        }
        if (node.children) {
          const [newChildren, childRemoved] = removeNode(node.children, key);
          node.children = newChildren;
          if (childRemoved) removed = childRemoved;
        }
        return true;
      });
      return [filtered, removed];
    };
    const [newData, removedNode] = removeNode([...data], key);
    if (removedNode) {
      setDeletedNodes((prev) => [
        ...prev,
        { node: removedNode, originParentKey: parentKey },
      ]);
      setData(newData);
      // 不修改 expandedKeys，保持原样
      onChange(newData, [
        ...deletedNodes,
        { node: removedNode, originParentKey: parentKey },
      ]);
    }
  };

  // 递归查找并恢复已删除节点
  const handleRestore = (key) => {
    // 递归查找目标节点及其父节点信息
    const findAndRemove = (nodes, key) => {
      for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        if (item.node.key === key) {
          // 找到目标，移除并返回
          const [removed] = nodes.splice(i, 1);
          return { found: removed, parentOriginKey: item.originParentKey };
        }
        if (item.node.children && item.node.children.length) {
          const result = findAndRemove(
            item.node.children.map((child) => ({
              node: child,
              originParentKey: item.node.key,
            })),
            key
          );
          if (result && result.found) {
            // 从原 children 中移除
            item.node.children = item.node.children.filter(
              (child) => child.key !== key
            );
            return result;
          }
        }
      }
      return null;
    };
    // 拷贝 deletedNodes 以便递归操作
    const deletedCopy = JSON.parse(JSON.stringify(deletedNodes));
    const result = findAndRemove(deletedCopy, key);
    if (!result || !result.found) return;
    const { node } = result.found;
    let parentKey = result.parentOriginKey;
    // 检查当前树中是否有原父节点
    const findNode = (nodes, k) => {
      for (const n of nodes) {
        if (n.key === k) return n;
        if (n.children) {
          const found = findNode(n.children, k);
          if (found) return found;
        }
      }
      return null;
    };
    let dataCopy = [...data];
    if (!findNode(dataCopy, parentKey)) {
      // 如果原父节点不存在，尝试找id=2的统一根节点
      const root2 = findNode(dataCopy, 2) || findNode(dataCopy, "2");
      parentKey = root2 ? root2.key : null;
    }
    const insertNode = (nodes, parentKey, node) => {
      if (!parentKey) return [...nodes, node]; // 插到根节点末尾
      return nodes.map((n) => {
        if (n.key === parentKey) {
          return {
            ...n,
            children: n.children ? [...n.children, node] : [node],
          };
        }
        if (n.children) {
          return { ...n, children: insertNode(n.children, parentKey, node) };
        }
        return n;
      });
    };
    const newData = insertNode(dataCopy, parentKey, node);
    setDeletedNodes(deletedCopy);
    setData(newData);
    // 不修改 expandedKeys，保持原样
    onChange(newData, deletedCopy);
  };

  // 展开所有节点
  const handleExpandAll = () => {
    const getAllKeys = (nodes) => {
      let keys = [];
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children) {
          keys = keys.concat(getAllKeys(node.children));
        }
      });
      return keys;
    };
    const allKeys = getAllKeys(data);
    setExpandedKeys(allKeys);
  };

  // 只在保存时才 setData 和 onChange
  const handleEdit = (key, value) => {
    const updateTitle = (nodes) =>
      nodes.map((node) => {
        if (node.key === key) {
          return { ...node, title: value };
        }
        if (node.children) {
          return { ...node, children: updateTitle(node.children) };
        }
        return node;
      });
    const newData = updateTitle(data);
    setData(newData);
    setEditingKey(null);
    setEditingValue("");
    setInputPos({ left: 0, top: 0, width: 0 });
    onChange(newData, deletedNodes);
  };

  // 只在渲染时处理 title
  const processTreeData = (nodes, parentKey = null, inDeleted = false) =>
    nodes.map((node) => {
      let titleContent;
      if (editingKey === node.key) {
        // 编辑时不渲染 title，浮动 Input 由外部渲染
        titleContent = (
          <span style={{ background: "#e6f4ff" }}>{node.title}</span>
        );
      } else {
        titleContent = (
          <span
            onDoubleClick={(e) => {
              setEditingKey(node.key);
              setEditingValue(node.title);
              // 计算节点位置
              const dom = e.target.getBoundingClientRect();
              const treeDom = treeRef.current?.getBoundingClientRect();
              setInputPos({
                left: dom.left - (treeDom?.left || 0),
                top: dom.top - (treeDom?.top || 0),
                width: dom.width,
              });
            }}
            style={{ cursor: "pointer" }}
            title="双击编辑名称"
          >
            {node.title}
            {!inDeleted && node.key !== "deleted" && (
              <>
                <Button
                  size="small"
                  danger
                  style={{ marginLeft: 12, height: 18, width: 40 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(node.key, parentKey);
                  }}
                >
                  删除
                </Button>
                <span
                  style={{ marginLeft: 8, color: "#888", fontSize: "12px" }}
                >
                  {node["权限码"] && node["权限类型"]
                    ? `${node["权限码"]}-${node["权限类型"]}`
                    : ""}
                </span>
              </>
            )}
          </span>
        );
      }
      return {
        ...node,
        title: titleContent,
        children: node.children
          ? processTreeData(node.children, node.key, inDeleted)
          : undefined,
      };
    });

  // 合并已删除节点到树根，已删除区展示为树结构
  const getFullTreeData = () => {
    const base = Array.isArray(data) ? data : [data];
    if (!deletedNodes.length) return base;
    // 递归构建已删除区树结构
    const buildDeletedTree = (nodes) =>
      nodes.map((item) => {
        return {
          ...item.node,
          title: (
            <span>
              {item.node.title}
              <Button
                size="small"
                type="link"
                style={{ marginLeft: 8 }}
                onClick={() => handleRestore(item.node.key)}
              >
                恢复
              </Button>
            </span>
          ),
          children: item.node.children
            ? buildDeletedTree(
                item.node.children.map((child) => ({
                  node: child,
                  originParentKey: item.node.key,
                }))
              )
            : undefined,
        };
      });
    return [
      ...base,
      {
        key: "deleted-root",
        title: "已删除",
        children: buildDeletedTree(deletedNodes),
      },
    ];
  };

  return (
    <div
      className="tree-display"
      style={{ position: "relative" }}
      ref={treeRef}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0 }}>树形结构</h2>
        <div className="tree-actions">
          <Button size="small" onClick={collapseSecondLevel}>
            收起二级节点
          </Button>
          <Button
            size="small"
            onClick={handleExpandAll}
            style={{ marginLeft: 8 }}
          >
            展开所有节点
          </Button>
        </div>
      </div>
      <div className="tree-container">
        <Tree
          className="draggable-tree"
          draggable
          blockNode
          onDragStart={() => {}}
          onDrop={onDrop}
          showLine
          expandedKeys={expandedKeys}
          onExpand={onExpand}
          treeData={processTreeData(getFullTreeData(), null, false)}
          height={window.innerHeight - 120}
        />
        {editingKey && (
          <Input
            size="small"
            autoFocus
            value={editingValue}
            style={{
              position: "absolute",
              left: inputPos.left,
              top: inputPos.top,
              width: 150,
              zIndex: 10,
            }}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleEdit(editingKey, editingValue)}
            onPressEnter={() => handleEdit(editingKey, editingValue)}
          />
        )}
      </div>
    </div>
  );
}

export default TreeDisplay;
