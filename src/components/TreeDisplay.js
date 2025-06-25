import React, { useState, useEffect, useRef } from "react";
import { Tree, Input, Button, Modal, Form } from "antd";

function TreeDisplay({
  treeData,
  onChange,
  isExportedExcel,
  initialDeletedNodes = [],
  initialReplacedNodes = [],
}) {
  const [data, setData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [inputPos, setInputPos] = useState({ left: 0, top: 0, width: 0 });
  const treeRef = useRef();

  // 记录被删除节点的原父key，便于恢复
  const [deletedNodes, setDeletedNodes] = useState([]); // [{node, originParentKey}]
  const [replacedNodes, setReplacedNodes] = useState([]); // [{node, originParentKey}]

  // 新增节点相关状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addParentNode, setAddParentNode] = useState(null);
  const [addForm] = Form.useForm();

  // 每次组件更新时都将最新的数据记录到ref中，确保导出时能获取到最新的状态
  const latestDataRef = useRef(null);

  // 初始化时，如果有initialDeletedNodes和initialReplacedNodes，则设置到状态中
  useEffect(() => {
    if (initialDeletedNodes && initialDeletedNodes.length > 0) {
      console.log(
        "TreeDisplay: 设置初始已删除节点",
        initialDeletedNodes.length
      );
      console.log(
        "初始已删除节点示例:",
        initialDeletedNodes.slice(0, 2).map((item) => ({
          key: item.node?.key,
          title: item.node?.title,
          操作: item.node?.操作,
        }))
      );
      setDeletedNodes(initialDeletedNodes);
    }

    if (initialReplacedNodes && initialReplacedNodes.length > 0) {
      console.log(
        "TreeDisplay: 设置初始已替换节点",
        initialReplacedNodes.length
      );
      console.log(
        "初始已替换节点示例:",
        initialReplacedNodes.slice(0, 2).map((item) => ({
          key: item.node?.key,
          title: item.node?.title,
          操作: item.node?.操作,
        }))
      );
      setReplacedNodes(initialReplacedNodes);
    }
  }, [initialDeletedNodes, initialReplacedNodes]);

  useEffect(() => {
    if (data && data.length > 0) {
      latestDataRef.current = [...data];
      console.log("数据已更新到ref:", latestDataRef.current.length);
    }
  }, [data]);

  useEffect(() => {
    if (treeData) {
      console.log("接收到treeData更新:", {
        类型: Array.isArray(treeData) ? "数组" : "对象",
        长度: Array.isArray(treeData) ? treeData.length : 1,
        节点类型: Array.isArray(treeData)
          ? treeData.map((node) => ({
              key: node.key,
              title: typeof node.title === "string" ? node.title : "组件",
            }))
          : [
              {
                key: treeData.key,
                title:
                  typeof treeData.title === "string" ? treeData.title : "组件",
              },
            ],
      });

      // 过滤掉特殊根节点（已删除和已替换），因为我们会在getFullTreeData中重新添加它们
      let filteredData = Array.isArray(treeData)
        ? treeData.filter(
            (node) =>
              node.key !== "deleted-root" && node.key !== "replaced-root"
          )
        : [treeData];

      console.log("过滤后的数据:", {
        长度: filteredData.length,
        节点类型: filteredData.map((node) => ({
          key: node.key,
          title: typeof node.title === "string" ? node.title : "组件",
        })),
      });

      setData(filteredData);

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
        collectKeys(filteredData);
        setExpandedKeys(keys);
      }
    }
  }, [treeData]);

  useEffect(() => {
    console.log("当前删除节点:", deletedNodes.length);
    console.log("当前替换节点:", replacedNodes.length);

    // 检查treeData中是否包含特殊根节点
    if (Array.isArray(treeData)) {
      const hasDeletedRoot = treeData.some(
        (node) => node.key === "deleted-root"
      );
      const hasReplacedRoot = treeData.some(
        (node) => node.key === "replaced-root"
      );
      console.log("树中包含已删除根节点:", hasDeletedRoot);
      console.log("树中包含已替换根节点:", hasReplacedRoot);
    }
  }, [treeData, deletedNodes, replacedNodes]);

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

    console.log("Drop info:", {
      dropKey,
      dragKey,
      dropPosition,
      dropToGap: info.dropToGap,
    });

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

    // 记录原始父级权限id，用于标记移动操作
    const originalParentId = dragObj["父级权限id"];

    // 标记节点为移动操作的函数
    const markNodeAsMoved = (node, newParentId) => {
      if (originalParentId !== newParentId) {
        // 如果节点已经有操作标记（如替换），保留原有操作并添加移动标记
        const existingOperation = node["操作"] || "";
        if (!existingOperation.includes("移动")) {
          node["操作"] = existingOperation
            ? `${existingOperation},移动`
            : "移动";
        }

        // 更新父级权限id
        node["父级权限id"] = newParentId;

        console.log(
          `节点 ${node.key} 被移动，原父级: ${originalParentId}, 新父级: ${newParentId}`
        );

        // 递归标记所有子节点
        if (node.children && node.children.length > 0) {
          node.children.forEach((child) => markNodeAsMoved(child, newParentId));
        }
      }
    };

    if (!info.dropToGap) {
      // 放置到节点上 - 添加为子节点
      loop(newData, dropKey, (item) => {
        item.children = item.children || [];
        // 保存父节点的权限id
        console.log("Parent node:", item);
        const newParentId = item["权限id"];
        dragObj["父级权限id"] = newParentId;
        dragObj.children = dragObj.children || [];

        // 标记节点及其所有子节点为移动操作
        markNodeAsMoved(dragObj, newParentId);

        item.children.unshift(dragObj);
      });
    } else if (
      (info.node.props.children || []).length > 0 && // 有子节点
      info.node.props.expanded && // 展开
      dropPosition === 1 // 在第一个子节点之上
    ) {
      loop(newData, dropKey, (item) => {
        item.children = item.children || [];
        // 保存父节点的权限id
        console.log("Parent node:", item);
        const newParentId = item["权限id"];
        dragObj["父级权限id"] = newParentId;
        dragObj.children = dragObj.children || [];

        // 标记节点及其所有子节点为移动操作
        markNodeAsMoved(dragObj, newParentId);

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

      // 在else分支中也需要标记移动操作
      // 需要找到新的父级权限id
      let newParentId = null;
      // 找到当前数组的父节点
      const findParent = (nodes, targetArray) => {
        for (const node of nodes) {
          if (node.children === targetArray) {
            return node;
          }
          if (node.children) {
            const found = findParent(node.children, targetArray);
            if (found) return found;
          }
        }
        return null;
      };

      const parent = findParent(newData, ar);
      if (parent) {
        newParentId = parent["权限id"];
      }

      // 如果找到了新的父级权限id且与原始不同，标记为移动
      if (newParentId && originalParentId !== newParentId) {
        dragObj["父级权限id"] = newParentId;

        // 标记节点及其所有子节点为移动操作
        markNodeAsMoved(dragObj, newParentId);
      }
    }

    console.log("After drop:", newData);
    setData(newData);
    onChange(newData, deletedNodes, replacedNodes);
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
      // 先创建新的 deletedNodes 数组，包含当前要删除的节点
      const updatedDeletedNodes = [
        ...deletedNodes,
        { node: removedNode, originParentKey: parentKey },
      ];

      // 更新状态
      setDeletedNodes(updatedDeletedNodes);
      setData(newData);

      // 使用更新后的 deletedNodes 调用 onChange
      onChange(newData, updatedDeletedNodes, [...replacedNodes]);

      // 标记节点为删除操作
      const existingOperation = removedNode["操作"] || "";
      // 对于删除操作，我们总是将其作为唯一操作，因为删除是终态操作
      if (!existingOperation.includes("删除")) {
        removedNode["操作"] = "删除";
      }
    }
  };

  // 递归查找节点
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

  // 替换节点及其子树
  const handleReplace = (key, parentKey = null) => {
    console.log("Replace node:", { key, parentKey });
    console.log("Current data:", data);

    // 首先找到父节点，获取其权限码
    let parentPermissionCode = null;
    if (parentKey) {
      const parentNode = findNode(data, parentKey);
      if (parentNode) {
        parentPermissionCode = parentNode["权限码"];
        console.log("Found parent node, 权限码:", parentPermissionCode);
      }
    }

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
      console.log("Removed node:", removedNode);
      // 保存原始权限id
      const originalPermissionId = removedNode["权限id"];
      // 保存原始权限码
      const originalPermissionCode = removedNode["权限码"];

      // 标记为替换，但不修改原始权限id
      // 获取现有操作标记
      const existingOperation = removedNode["操作"] || "";
      // 添加替换操作（如果不存在）
      const newOperation = !existingOperation.includes("替换")
        ? existingOperation
          ? `${existingOperation},替换`
          : "替换"
        : existingOperation;

      removedNode["操作"] = newOperation;
      // 记录父级权限码，用于导出时添加到"权限码（新）"列
      if (parentPermissionCode) {
        removedNode["父级权限码"] = parentPermissionCode;
      }

      console.log("After replace:", removedNode);

      // 使用Map避免重复
      setReplacedNodes((prev) => {
        const map = new Map();
        prev.forEach((item) => {
          // 确保使用原始的 key 作为 map 的键
          const nodeKey = item.node.key;
          map.set(nodeKey, item);
        });

        // 确保使用原始的 key 作为 map 的键，而不是修改后的权限id
        const nodeKey = key;
        console.log(
          `设置替换节点: key=${nodeKey}, 原权限id=${originalPermissionId}, 权限码=${originalPermissionCode}, 父级权限码=${parentPermissionCode}`
        );

        map.set(nodeKey, {
          node: removedNode,
          originParentKey: parentKey,
          originalPermissionId: originalPermissionId,
          originalPermissionCode: originalPermissionCode,
          parentPermissionCode: parentPermissionCode,
        });
        const updated = Array.from(map.values());

        // Debug
        console.log(
          "更新后的replacedNodes:",
          updated.map((item) => ({
            key: item.node.key,
            originalPermissionId: item.originalPermissionId,
            originalPermissionCode: item.originalPermissionCode,
            parentPermissionCode: item.parentPermissionCode,
          }))
        );

        setData(newData);
        onChange(newData, deletedNodes, updated);
        return updated;
      });
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
    onChange(newData, deletedCopy, replacedNodes);
  };

  // 递归查找并恢复已替换节点
  const handleRestoreReplaced = (key) => {
    const findAndRemove = (nodes, key) => {
      for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        if (item.node.key === key) {
          // 找到目标，移除并返回
          const [removed] = nodes.splice(i, 1);
          return {
            found: removed,
            parentOriginKey: item.originParentKey,
            originalPermissionId: item.originalPermissionId,
          };
        }
        if (item.node.children && item.node.children.length) {
          const result = findAndRemove(
            item.node.children.map((child) => ({
              node: child,
              originParentKey: item.node.key,
              originalPermissionId: child["原始权限id"] || child["权限id"],
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
    // 拷贝 replacedNodes 以便递归操作
    const replacedCopy = JSON.parse(JSON.stringify(replacedNodes));
    const result = findAndRemove(replacedCopy, key);
    if (!result || !result.found) return;
    const { node } = result.found;
    let parentKey = result.parentOriginKey;

    // 清除操作标记和父级权限码
    delete node["操作"];
    delete node["父级权限码"];

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
      const root2 = findNode(dataCopy, 2) || findNode(dataCopy, "2");
      parentKey = root2 ? root2.key : null;
    }

    const insertNode = (nodes, parentKey, node) => {
      if (!parentKey) return [...nodes, node];
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
    setReplacedNodes(replacedCopy);
    setData(newData);
    // 恢复替换节点后，传递完整的 replacedCopy 给 App
    console.log("恢复替换节点后的 replacedCopy:", replacedCopy);
    onChange(newData, deletedNodes, replacedCopy);
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
          // 如果标题发生变化，标记为修改操作
          const originalTitle = node.title;
          if (originalTitle !== value) {
            console.log(
              `节点 ${key} 标题被修改，原标题: ${originalTitle}, 新标题: ${value}`
            );
            // 获取现有操作标记
            const existingOperation = node["操作"] || "";
            // 添加修改操作（如果不存在）
            const newOperation = !existingOperation.includes("修改")
              ? existingOperation
                ? `${existingOperation},修改`
                : "修改"
              : existingOperation;

            return {
              ...node,
              title: value,
              操作: newOperation,
              原始标题: originalTitle,
            };
          }
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
    onChange(newData, deletedNodes, replacedNodes);
  };

  // 只在渲染时处理 title
  const processTreeData = (nodes, parentKey = null, inSpecialRoot = false) =>
    nodes.map((node) => {
      // 检查是否位于特殊根节点下（已删除或已替换）
      let isInSpecialRoot =
        inSpecialRoot ||
        node.key === "deleted-root" ||
        node.key === "replaced-root" ||
        parentKey === "deleted-root" ||
        parentKey === "replaced-root";

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
            {!isInSpecialRoot &&
              node.key !== "deleted" &&
              node.key !== "deleted-root" &&
              node.key !== "replaced-root" && (
                <>
                  {/* <Button
                    size="small"
                    style={{ marginLeft: 12, height: 18, width: 40 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(node);
                    }}
                  >
                    新增
                  </Button> */}
                  <Button
                    size="small"
                    danger
                    style={{ marginLeft: 8, height: 18, width: 40 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(node.key, parentKey);
                    }}
                  >
                    删除
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    style={{ marginLeft: 8, height: 18, width: 40 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplace(node.key, parentKey);
                    }}
                  >
                    替换
                  </Button>
                  <span
                    style={{ marginLeft: 8, color: "#888", fontSize: "12px" }}
                  >
                    {node["权限码"] && node["权限类型"] ? (
                      <>
                        <span style={{ color: "#1890ff", fontWeight: "bold" }}>
                          {node["权限码"]}
                        </span>{" "}
                        <span style={{ color: "#52c41a" }}>
                          {node["权限类型"]}
                        </span>
                      </>
                    ) : (
                      ""
                    )}
                    {node["原权限id"] && (
                      <span style={{ marginLeft: 8, color: "#ff4d4f" }}>
                        (原权限id: {node["原权限id"]})
                      </span>
                    )}
                    {node["新权限id"] && (
                      <span style={{ marginLeft: 8, color: "#722ed1" }}>
                        (新权限id: {node["新权限id"]})
                      </span>
                    )}
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
          ? processTreeData(node.children, node.key, isInSpecialRoot)
          : undefined,
      };
    });

  // 获取完整树数据，包括操作标记
  const getFullTreeData = () => {
    // 新增log，帮助调试
    console.log("getFullTreeData 被调用");
    console.log("当前数据状态:", data.length);
    console.log("当前删除节点:", deletedNodes.length);
    console.log("当前替换节点:", replacedNodes.length);
    console.log("是否为导出后的Excel:", isExportedExcel);

    // 检查删除节点的结构
    if (deletedNodes.length > 0) {
      console.log(
        "删除节点示例:",
        deletedNodes.slice(0, 2).map((item) => ({
          key: item.node?.key,
          title: item.node?.title,
          操作: item.node?.操作,
        }))
      );
    }

    // 检查替换节点的结构
    if (replacedNodes.length > 0) {
      console.log(
        "替换节点示例:",
        replacedNodes.slice(0, 2).map((item) => ({
          key: item.node?.key,
          title: item.node?.title,
          操作: item.node?.操作,
        }))
      );
    }

    // 统一处理key类型为字符串
    const normalizeKey = (key) => (key !== undefined ? String(key) : "");

    const processNode = (node) => {
      const processedNode = { ...node };
      // 处理可能的children
      if (node.children && Array.isArray(node.children)) {
        processedNode.children = node.children.map(processNode);
      }
      return processedNode;
    };

    // 首先复制当前数据
    const base = Array.isArray(data)
      ? data.map(processNode)
      : data
      ? [processNode(data)]
      : [];

    // 检查base中是否有新增节点
    const hasNewNodes = base.some((node) => {
      const checkNodeHasNewFlag = (n) => {
        if (n.操作 && n.操作.includes("新增")) return true;
        if (n.children && Array.isArray(n.children)) {
          return n.children.some(checkNodeHasNewFlag);
        }
        return false;
      };
      return checkNodeHasNewFlag(node);
    });

    console.log("基础数据中包含新增节点:", hasNewNodes);
    console.log("基础数据:", {
      长度: base.length,
      节点类型: base.map((node) => ({
        key: node.key,
        title: typeof node.title === "string" ? node.title : "组件",
      })),
    });

    // 如果没有删除或替换节点，并且不是导出后的Excel，直接返回基础数据
    if (!deletedNodes.length && !replacedNodes.length && !isExportedExcel) {
      console.log("没有删除或替换节点，返回基础数据");
      return base;
    }

    console.log("构建完整树数据:", {
      base: base.length,
      deletedNodes: deletedNodes.length,
      replacedNodes: replacedNodes.length,
    });

    const buildDeletedTree = (nodes) => {
      console.log("构建已删除树，节点数:", nodes.length);
      if (nodes.length === 0) return [];

      return nodes
        .map((item) => {
          if (!item || !item.node) {
            console.log("警告: 发现无效的删除节点项", item);
            return null;
          }

          // 标记当前节点为删除操作
          if (item.node && item.node["操作"] === undefined) {
            item.node["操作"] = "删除";
          }

          // 递归标记所有子节点为删除操作
          const markChildrenAsDeleted = (node) => {
            if (!node) return;

            if (node["操作"] === undefined) {
              node["操作"] = "删除";
            }

            if (node.children && node.children.length) {
              node.children.forEach(markChildrenAsDeleted);
            }
          };

          // 处理子节点
          if (item.node && item.node.children) {
            item.node.children.forEach(markChildrenAsDeleted);
          }

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
        })
        .filter(Boolean); // 过滤掉null项
    };

    const buildReplacedTree = (nodes) => {
      console.log("构建已替换树，节点数:", nodes.length);
      if (nodes.length === 0) return [];

      return nodes
        .map((item) => {
          if (!item || !item.node) {
            console.log("警告: 发现无效的替换节点项", item);
            return null;
          }

          // 新增：渲染时带出原权限id和新权限id
          const originalId = item.originalPermissionId;
          const newId = item.node["权限id"];
          return {
            ...item.node,
            title: (
              <span>
                {item.node.title}
                <span style={{ marginLeft: 8, color: "#ff4d4f" }}>
                  {item.node["父级权限码"]
                    ? `(新权限码: ${item.node["父级权限码"]})`
                    : ""}
                </span>
                <span style={{ marginLeft: 8, color: "#722ed1" }}>
                  {newId && originalId && newId !== originalId
                    ? `(新权限id: ${newId})`
                    : ""}
                </span>
                <Button
                  size="small"
                  type="link"
                  style={{ marginLeft: 8 }}
                  onClick={() => handleRestoreReplaced(item.node.key)}
                >
                  恢复
                </Button>
              </span>
            ),
            children: item.node.children
              ? buildReplacedTree(
                  item.node.children.map((child) => ({
                    node: child,
                    originParentKey: item.node.key,
                    originalPermissionId:
                      child["原始权限id"] || child["权限id"],
                  }))
                )
              : undefined,
          };
        })
        .filter(Boolean); // 过滤掉null项
    };

    // 构建结果树，包括基础数据和特殊根节点
    const result = [...base];

    // 只有当有删除节点时，才添加删除根节点
    if (deletedNodes.length > 0) {
      console.log("添加已删除根节点，包含", deletedNodes.length, "个节点");
      const deletedChildren = buildDeletedTree(deletedNodes);
      if (deletedChildren.length > 0) {
        result.push({
          key: "deleted-root",
          title: "已删除",
          children: deletedChildren,
          isSpecialRoot: true,
        });
      } else {
        console.log("警告: 已删除节点列表为空，不添加已删除根节点");
      }
    }

    // 只有当有替换节点时，才添加替换根节点
    if (replacedNodes.length > 0) {
      console.log("添加已替换根节点，包含", replacedNodes.length, "个节点");
      const replacedChildren = buildReplacedTree(replacedNodes);
      if (replacedChildren.length > 0) {
        result.push({
          key: "replaced-root",
          title: "已替换",
          children: replacedChildren,
          isSpecialRoot: true,
        });
      } else {
        console.log("警告: 已替换节点列表为空，不添加已替换根节点");
      }
    }

    console.log("最终树数据:", {
      总节点数: result.length,
      节点类型: result.map((node) => ({
        key: node.key,
        title: typeof node.title === "string" ? node.title : "组件",
      })),
    });
    return result;
  };

  // 递归拍平树结构，包含"已替换"节点
  function flattenTree(nodes, parentId = "", isInDeletedRoot = false) {
    let result = [];
    nodes.forEach((node) => {
      // 检查是否在"已删除"根节点下
      if (node.key === "deleted-root") {
        if (node.children && node.children.length) {
          // 传递 isInDeletedRoot = true 标记进入已删除区域
          result = result.concat(flattenTree(node.children, "", true));
        }
        return;
      } else if (node.key === "replaced-root") {
        if (node.children && node.children.length) {
          result = result.concat(flattenTree(node.children, "", false));
        }
        return;
      }

      const { children, ...rest } = node;
      rest["父级权限id"] = parentId;

      // 如果节点在"已删除"根节点下，标记为"删除"
      if (isInDeletedRoot) {
        rest["操作"] = "删除";
      }

      result.push(rest);
      if (children && children.length) {
        // 传递 isInDeletedRoot 参数，保持删除状态
        result = result.concat(
          flattenTree(children, node["权限id"], isInDeletedRoot)
        );
      }
    });
    return result;
  }

  // 导出 Excel 逻辑
  const exportToExcel = () => {
    // 使用XLSX库
    const XLSX = require("xlsx");

    // 确保使用最新的数据
    const currentData = latestDataRef.current || data;

    console.log("准备导出，当前数据状态:", {
      dataLength: currentData?.length || 0,
      nodesWithChildren:
        currentData?.filter((n) => n.children && n.children.length).length || 0,
      deletedNodesLength: deletedNodes.length,
      replacedNodesLength: replacedNodes.length,
    });

    // 使用组件内部的数据状态，包含所有节点（常规节点、删除节点、替换节点）
    const exportRows = [];
    // 使用Set记录已处理的节点ID，防止重复
    const processedNodeIds = new Set();

    // 首先收集所有常规节点（包括新增的）
    const collectNodesForExport = (nodes, path = "") => {
      console.log(
        `收集节点，当前路径: ${path}, 节点数量: ${nodes?.length || 0}`
      );

      if (!nodes || nodes.length === 0) return;

      // 深度优先搜索，确保收集所有嵌套层级的节点
      const deepCollect = (node, nodePath) => {
        if (!node) return;

        // 获取节点唯一标识
        const nodeId = String(node.权限id || node.key || "");

        // 如果节点已被处理过，则跳过以避免重复
        if (nodeId && processedNodeIds.has(nodeId)) {
          console.log(`节点 ${nodeId} 已处理过，跳过`);
          return;
        }

        // 记录已处理过的节点
        if (nodeId) {
          processedNodeIds.add(nodeId);
        }

        const currentPath = nodePath ? `${nodePath}->${node.key}` : node.key;
        console.log(`深度处理节点: ${currentPath}, 操作: ${node.操作 || "无"}`);

        // 处理当前节点
        const nodeCopy = { ...node };

        // 处理title（如果是React元素）
        if (typeof nodeCopy.title === "object") {
          nodeCopy.title = String(nodeCopy.title.props?.children || "")
            .replace(/新增|删除|替换|恢复/g, "")
            .trim();
        }

        // 分离children，保留纯数据
        const { children, ...nodeData } = nodeCopy;

        // 处理移动节点
        if (
          nodeData["操作"] === "移动" ||
          (nodeData["操作"] && nodeData["操作"].includes("移动"))
        ) {
          nodeData["父级权限id（新）"] = nodeData["父级权限id"];
          if (nodeData["原父级权限id"] !== undefined) {
            nodeData["父级权限id"] = nodeData["原父级权限id"];
          }
        }

        console.log(
          `添加节点到导出行: ${nodeData.key || nodeData.title}, 操作: ${
            nodeData.操作 || "无"
          }`
        );
        exportRows.push(nodeData);

        // 递归处理子节点
        if (children && Array.isArray(children)) {
          children.forEach((child) => deepCollect(child, currentPath));
        }
      };

      // 对每个顶层节点进行深度优先遍历
      nodes.forEach((node) => {
        if (node.key === "deleted-root" || node.key === "replaced-root") {
          console.log(`跳过特殊根节点: ${node.key}`);
          return;
        }

        deepCollect(node, path);
      });
    };

    // 收集当前数据中的所有节点
    console.log("开始收集常规节点...");
    collectNodesForExport(currentData);

    // 另外收集已删除节点
    console.log("开始收集已删除节点...");
    deletedNodes.forEach((item, index) => {
      console.log(`处理已删除节点 ${index}: ${item.node?.key || "未知"}`);

      if (!item.node) return;

      // 获取唯一标识
      const nodeId = String(item.node.权限id || item.node.key || "");

      // 如果节点已被处理过，则跳过以避免重复
      if (nodeId && processedNodeIds.has(nodeId)) {
        console.log(`已删除节点 ${nodeId} 已处理过，跳过`);
        return;
      }

      // 记录已处理过的节点
      if (nodeId) {
        processedNodeIds.add(nodeId);
      }

      // 确保节点被标记为"删除"
      const nodeData = { ...item.node, 操作: "删除" };

      // 处理可能的React元素
      if (typeof nodeData.title === "object") {
        nodeData.title = String(nodeData.title.props?.children || "")
          .replace(/新增|删除|替换|恢复/g, "")
          .trim();
      }

      // 处理可能的子节点
      if (nodeData.children) {
        delete nodeData.children;
      }

      console.log(`添加已删除节点到导出行: ${nodeData.key || nodeData.title}`);
      exportRows.push(nodeData);
    });

    // 收集已替换节点
    console.log("开始收集已替换节点...");
    replacedNodes.forEach((item, index) => {
      console.log(`处理已替换节点 ${index}: ${item.node?.key || "未知"}`);

      if (!item.node) return;

      // 获取唯一标识
      const nodeId = String(item.node.权限id || item.node.key || "");

      // 如果节点已被处理过，则跳过以避免重复
      if (nodeId && processedNodeIds.has(nodeId)) {
        console.log(`已替换节点 ${nodeId} 已处理过，跳过`);
        return;
      }

      // 记录已处理过的节点
      if (nodeId) {
        processedNodeIds.add(nodeId);
      }

      // 确保节点被标记为"替换"
      const nodeData = { ...item.node, 操作: "替换" };

      // 处理可能的React元素
      if (typeof nodeData.title === "object") {
        nodeData.title = String(nodeData.title.props?.children || "")
          .replace(/新增|删除|替换|恢复/g, "")
          .trim();
      }

      // 处理父级权限码（用于标记新的权限码）
      if (nodeData["父级权限码"]) {
        nodeData["权限码（新）"] =
          nodeData["父级权限码"] + nodeData["权限码"].slice(-3);
      }

      // 处理可能的子节点
      if (nodeData.children) {
        delete nodeData.children;
      }

      console.log(`添加已替换节点到导出行: ${nodeData.key || nodeData.title}`);
      exportRows.push(nodeData);
    });

    console.log("导出的行数据总数:", exportRows.length);
    console.log(
      "是否包含新增节点:",
      exportRows.some((row) => row["操作"] === "新增"),
      "数量:",
      exportRows.filter((row) => row["操作"] === "新增").length
    );
    console.log(
      "是否包含删除节点:",
      exportRows.some((row) => row["操作"] === "删除"),
      "数量:",
      exportRows.filter((row) => row["操作"] === "删除").length
    );
    console.log(
      "是否包含替换节点:",
      exportRows.some((row) => row["操作"] === "替换"),
      "数量:",
      exportRows.filter((row) => row["操作"] === "替换").length
    );

    // 格式化导出数据
    const exportData = exportRows.map((row) => ({
      权限码: row["权限码"] || "",
      "权限码（新）": row["权限码（新）"] || "",
      权限名称: row["权限名称"] || row.title || "",
      权限类型: row["权限类型"] || "",
      权限id: row["权限id"] || row.key || "",
      父级权限名称: row["父级权限名称"] || "",
      父级权限id: row["父级权限id"] || "",
      "父级权限id（新）": row["父级权限id（新）"] || "",
      权限路径: row["权限路径"] || "",
      是否有子节点:
        row["是否有子节点"] ||
        (row.children && row.children.length ? "是" : "否"),
      站点: row["站点"] || "",
      操作: row["操作"] || "",
    }));

    const exportColumns = [
      "权限码",
      "权限码（新）",
      "权限名称",
      "权限类型",
      "权限id",
      "父级权限名称",
      "父级权限id",
      "父级权限id（新）",
      "权限路径",
      "是否有子节点",
      "站点",
      "操作",
    ];

    const ws = XLSX.utils.json_to_sheet(exportData, { header: exportColumns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "tree-data.xlsx");

    console.log("Excel导出成功，数据行数:", exportData.length);
  };

  // 处理新增节点
  const handleAdd = (parentNode) => {
    console.log("点击新增按钮，父节点:", parentNode);
    setAddParentNode(parentNode);
    setAddModalVisible(true);
    addForm.resetFields();
  };

  // 确认添加新节点
  const handleAddConfirm = () => {
    addForm.validateFields().then((values) => {
      // 给节点一个唯一标识
      const newKey = values.key || `new-${Date.now()}`;

      const newNode = {
        key: newKey,
        title: values.title,
        权限id: newKey,
        权限名称: values.title,
        权限码: values.permissionCode,
        权限类型: values.permissionType,
        父级权限id: addParentNode["权限id"] || addParentNode.key,
        操作: "新增", // 新增节点不需要保留现有操作标记，因为它是新创建的
      };

      console.log("===== 开始新增节点 =====");
      console.log("新节点:", newNode);
      console.log("父节点:", addParentNode);

      // 打印父节点关键信息，便于调试
      if (addParentNode) {
        console.log("父节点key:", addParentNode.key);
        console.log("父节点权限id:", addParentNode["权限id"]);
      }

      console.log("当前树数据:", data);

      // 关键点：确保key的类型一致性，有些可能是数字有些可能是字符串
      const normalizeKey = (key) => (key !== undefined ? String(key) : "");
      const parentNodeKey = normalizeKey(addParentNode.key);

      // 更安全的查找父节点并添加子节点的方法
      const addChildToParent = (nodes, targetParentKey) => {
        if (!nodes) return [];

        // 转为字符串便于比较
        targetParentKey = normalizeKey(targetParentKey);

        return nodes.map((node) => {
          // 确保node.key存在并转为字符串比较
          const currentKey =
            node.key !== undefined ? normalizeKey(node.key) : "";

          // 比较两种可能的key: 节点的key和权限id
          const nodePermissionId = normalizeKey(node["权限id"]);

          // 找到父节点 - 同时检查key和权限id
          if (
            currentKey === targetParentKey ||
            nodePermissionId === targetParentKey
          ) {
            console.log("找到父节点:", node);

            // 为父节点添加children数组（如果不存在）
            const updatedChildren = node.children
              ? [...node.children, newNode]
              : [newNode];

            // 确保展开父节点以显示新节点
            if (!expandedKeys.includes(currentKey)) {
              console.log(`展开父节点 ${currentKey}`);
              setExpandedKeys((prevKeys) => [...prevKeys, currentKey]);
            }

            console.log("更新后的父节点children:", updatedChildren);
            return { ...node, children: updatedChildren };
          }

          // 递归查找子节点
          if (node.children && node.children.length > 0) {
            const newChildren = addChildToParent(
              node.children,
              targetParentKey
            );
            // 仅当子节点有变化时才创建新对象
            if (newChildren !== node.children) {
              console.log(`节点 ${node.key} 的子节点已更新`);
              return { ...node, children: newChildren };
            }
          }

          return node;
        });
      };

      // 添加子节点
      const newData = addChildToParent(data, parentNodeKey);

      console.log("修改后的数据结构:", newData);
      console.log(`预期在节点 ${parentNodeKey} 下添加新节点 ${newKey}`);

      // 验证新节点是否成功添加到树中
      const verifyNodeAdded = (treeData, parentKey, childKey) => {
        parentKey = normalizeKey(parentKey);
        childKey = normalizeKey(childKey);

        const findNode = (nodes) => {
          if (!nodes) return false;

          for (const node of nodes) {
            if (
              normalizeKey(node.key) === parentKey ||
              normalizeKey(node["权限id"]) === parentKey
            ) {
              if (
                node.children &&
                node.children.some(
                  (child) =>
                    normalizeKey(child.key) === childKey ||
                    normalizeKey(child["权限id"]) === childKey
                )
              ) {
                return true;
              }
              return false;
            }
            if (node.children && findNode(node.children)) {
              return true;
            }
          }
          return false;
        };

        return findNode(treeData);
      };

      const nodeAdded = verifyNodeAdded(newData, parentNodeKey, newKey);
      console.log(`验证新节点是否添加: ${nodeAdded ? "成功" : "失败"}`);

      // 强制更新状态以确保重渲染
      setData([...newData]);
      onChange([...newData], deletedNodes, replacedNodes);

      // 延时检查状态更新
      setTimeout(() => {
        console.log("状态更新后检查:", latestDataRef.current);
      }, 100);

      setAddModalVisible(false);
      console.log("===== 新增节点结束 =====");
    });
  };

  // 重载Tree组件的更新触发
  useEffect(() => {
    // 强制刷新树显示
    const triggerTreeRefresh = () => {
      setData((prevData) => [...prevData]);
    };

    // 在新增节点后，可能需要额外的刷新来确保UI更新
    if (data && data.length > 0) {
      // 延迟执行以确保React状态已更新
      const timer = setTimeout(triggerTreeRefresh, 100);
      return () => clearTimeout(timer);
    }
  }, [data.length]);

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
          justifyContent: "left",
        }}
      >
        <h2 style={{ margin: 0 }}>树形结构</h2>
        <div className="tree-actions">
          <Button
            style={{ marginLeft: 20 }}
            size="small"
            onClick={collapseSecondLevel}
          >
            收起二级节点
          </Button>
          <Button
            size="small"
            onClick={handleExpandAll}
            style={{ marginLeft: 8 }}
          >
            展开所有节点
          </Button>
          {isExportedExcel && (
            <span style={{ marginLeft: 16, color: "#1890ff" }}>
              当前为导出后的Excel文件
              {deletedNodes.length > 0 &&
                ` (包含${deletedNodes.length}个已删除节点)`}
              {replacedNodes.length > 0 &&
                ` (包含${replacedNodes.length}个已替换节点)`}
            </span>
          )}
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

      {/* 新增节点弹窗 */}
      <Modal
        title="新增节点"
        open={addModalVisible}
        onOk={handleAddConfirm}
        onCancel={() => setAddModalVisible(false)}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            name="key"
            label="权限ID"
            rules={[{ required: true, message: "请输入权限ID" }]}
          >
            <Input placeholder="请输入权限ID" />
          </Form.Item>
          <Form.Item
            name="title"
            label="权限名称"
            rules={[{ required: true, message: "请输入权限名称" }]}
          >
            <Input placeholder="请输入权限名称" />
          </Form.Item>
          <Form.Item
            name="permissionCode"
            label="权限码"
            rules={[{ required: true, message: "请输入权限码" }]}
          >
            <Input placeholder="请输入权限码" />
          </Form.Item>
          <Form.Item
            name="permissionType"
            label="权限类型"
            rules={[{ required: true, message: "请输入权限类型" }]}
          >
            <Input placeholder="请输入权限类型" />
          </Form.Item>
          {addParentNode && (
            <div style={{ marginBottom: 16 }}>
              <p>父级节点: {addParentNode.title}</p>
              <p>父级权限ID: {addParentNode["权限id"] || addParentNode.key}</p>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default TreeDisplay;
